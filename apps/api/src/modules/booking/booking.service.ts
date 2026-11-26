import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AvailabilityQuery,
  CancelAppointmentInput,
  CreateAppointmentInput,
  JoinWaitlistInput,
  RescheduleAppointmentInput,
} from '@careconnect/validation';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  clinicStaff,
  clinics,
  practitionerClinic,
  practitionerLeave,
  practitioners,
  waitlistEntries,
} from '../../common/database/schema';
import {
  AppointmentBookedEvent,
  AppointmentCancelledEvent,
  AppointmentRescheduledEvent,
  EVENT_APPOINTMENT_BOOKED,
  EVENT_APPOINTMENT_CANCELLED,
  EVENT_APPOINTMENT_RESCHEDULED,
  EVENT_WAITLIST_OFFERED,
  WaitlistOfferedEvent,
} from '../notifications/events';
import { PatientsService } from '../patients/patients.service';
import {
  computeAvailableSlots,
  type DayAvailability,
  toClinicDateString,
  type WeeklyTimings,
} from './availability';

/** Statuses that occupy a slot and therefore block new bookings. */
const ACTIVE_APPOINTMENT_STATUSES = ['booked', 'checked_in'] as const;

function isActiveStatus(status: string): boolean {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type PracticeConfig = typeof practitionerClinic.$inferSelect;

interface SlotParams {
  practitionerId: string;
  clinicId: string;
  scheduledStart: Date;
  /** The appointment being moved, which must not block its own new time. */
  excludeAppointmentId?: string;
}

@Injectable()
export class BookingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly patientsService: PatientsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAvailability(query: AvailabilityQuery) {
    const practice = await this.getPracticeOrThrow(this.db, query);
    return this.computeAvailability(this.db, practice, query);
  }

  private async getPracticeOrThrow(
    db: Database | Transaction,
    where: { practitionerId: string; clinicId: string },
  ): Promise<PracticeConfig> {
    const [practice] = await db
      .select()
      .from(practitionerClinic)
      .where(
        and(
          eq(practitionerClinic.practitionerId, where.practitionerId),
          eq(practitionerClinic.clinicId, where.clinicId),
          eq(practitionerClinic.isActive, true),
        ),
      )
      .limit(1);
    if (!practice) {
      throw new NotFoundException(
        'This practitioner does not practise at this clinic',
      );
    }
    return practice;
  }

  private async computeAvailability(
    db: Database | Transaction,
    practice: PracticeConfig,
    query: { fromDate: string; toDate: string },
    excludeAppointmentId?: string,
  ): Promise<DayAvailability[]> {
    const fromStart = new Date(`${query.fromDate}T00:00:00+05:00`);
    const toEnd = new Date(`${query.toDate}T23:59:59+05:00`);

    const [busy, leave] = await Promise.all([
      db
        .select({
          scheduledStart: appointments.scheduledStart,
          scheduledEnd: appointments.scheduledEnd,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.practitionerId, practice.practitionerId),
            eq(appointments.clinicId, practice.clinicId),
            inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
            gte(appointments.scheduledStart, fromStart),
            lte(appointments.scheduledStart, toEnd),
            excludeAppointmentId
              ? ne(appointments.id, excludeAppointmentId)
              : undefined,
          ),
        ),
      db
        .select({
          startsOn: practitionerLeave.startsOn,
          endsOn: practitionerLeave.endsOn,
        })
        .from(practitionerLeave)
        .where(
          and(
            eq(practitionerLeave.practitionerId, practice.practitionerId),
            // clinicId null = leave applies to all of this practitioner's clinics
            or(
              eq(practitionerLeave.clinicId, practice.clinicId),
              isNull(practitionerLeave.clinicId),
            ),
          ),
        ),
    ]);

    return computeAvailableSlots({
      timings: practice.timings as WeeklyTimings,
      slotLengthMinutes: practice.slotLengthMinutes,
      dailyPatientCap: practice.dailyPatientCap,
      fromDate: query.fromDate,
      toDate: query.toDate,
      busyRanges: busy.map((b) => ({
        start: b.scheduledStart,
        end: b.scheduledEnd,
      })),
      leaveRanges: leave,
    });
  }

  async createAppointment(callerId: string, input: CreateAppointmentInput) {
    if (input.subjectType === 'family_member') {
      await this.patientsService.assertFamilyMemberOwnedBy(
        callerId,
        input.familyMemberId!,
      );
    }

    const scheduledStart = new Date(input.scheduledStart);
    const row = await this.withOpenSlot(
      {
        practitionerId: input.practitionerId,
        clinicId: input.clinicId,
        scheduledStart,
      },
      async (tx, scheduledEnd) => {
        const [inserted] = await tx
          .insert(appointments)
          .values({
            patientId: callerId,
            subjectType: input.subjectType,
            familyMemberId:
              input.subjectType === 'family_member'
                ? input.familyMemberId
                : null,
            practitionerId: input.practitionerId,
            clinicId: input.clinicId,
            scheduledStart,
            scheduledEnd,
            status: 'booked',
            bookedByUserId: callerId,
          })
          .returning();
        return inserted;
      },
    );
    if (!row) {
      throw new Error('Insert did not return the new appointment');
    }

    // Awaited: Vercel can freeze the function once the response is sent.
    await this.eventEmitter.emitAsync(
      EVENT_APPOINTMENT_BOOKED,
      new AppointmentBookedEvent({
        appointmentId: row.id,
        patientId: row.patientId,
        practitionerId: row.practitionerId,
        clinicId: row.clinicId,
        scheduledStart: row.scheduledStart,
      }),
    );
    return row;
  }

  async rescheduleAppointment(
    callerId: string,
    input: RescheduleAppointmentInput,
  ) {
    const appointment = await this.getAppointmentOrThrow(input.appointmentId);
    const isStaff = await this.assertCanManage(callerId, appointment);
    if (appointment.status !== 'booked') {
      throw this.wrongStatus('reschedule', appointment.status);
    }
    if (!isStaff) {
      await this.assertOutsideCancellationWindow(appointment);
    }

    const scheduledStart = new Date(input.scheduledStart);
    const previousStart = appointment.scheduledStart;
    const row = await this.withOpenSlot(
      {
        practitionerId: appointment.practitionerId,
        clinicId: appointment.clinicId,
        scheduledStart,
        excludeAppointmentId: appointment.id,
      },
      async (tx, scheduledEnd) => {
        const [updated] = await tx
          .update(appointments)
          .set({ scheduledStart, scheduledEnd })
          .where(
            and(
              eq(appointments.id, appointment.id),
              // Re-checked: it may have been cancelled since it was read.
              eq(appointments.status, 'booked'),
            ),
          )
          .returning();
        return updated;
      },
    );
    if (!row) {
      throw new ConflictException('This appointment can no longer be changed');
    }

    // Awaited: Vercel can freeze the function once the response is sent.
    await this.eventEmitter.emitAsync(
      EVENT_APPOINTMENT_RESCHEDULED,
      new AppointmentRescheduledEvent(
        {
          appointmentId: row.id,
          patientId: row.patientId,
          practitionerId: row.practitionerId,
          clinicId: row.clinicId,
          scheduledStart: row.scheduledStart,
        },
        previousStart,
      ),
    );
    // The old date just lost a booking — someone on the waitlist for it
    // may now be able to get in.
    await this.offerNextWaitlistSlot(
      row.practitionerId,
      row.clinicId,
      toClinicDateString(previousStart),
    );
    return row;
  }

  async cancelAppointment(callerId: string, input: CancelAppointmentInput) {
    const appointment = await this.getAppointmentOrThrow(input.appointmentId);
    const isStaff = await this.assertCanManage(callerId, appointment);
    if (!isActiveStatus(appointment.status)) {
      throw this.wrongStatus('cancel', appointment.status);
    }
    if (!isStaff) {
      await this.assertOutsideCancellationWindow(appointment);
    }

    const [row] = await this.db
      .update(appointments)
      .set({
        status: 'cancelled',
        cancellationReason: input.reason,
        cancelledByUserId: callerId,
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(appointments.id, appointment.id),
          // Re-checked: it may have changed since it was read.
          inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
        ),
      )
      .returning();
    if (!row) {
      throw new ConflictException('This appointment can no longer be changed');
    }

    // Awaited: Vercel can freeze the function once the response is sent.
    await this.eventEmitter.emitAsync(
      EVENT_APPOINTMENT_CANCELLED,
      new AppointmentCancelledEvent(
        {
          appointmentId: row.id,
          patientId: row.patientId,
          practitionerId: row.practitionerId,
          clinicId: row.clinicId,
          scheduledStart: row.scheduledStart,
        },
        isStaff,
      ),
    );
    await this.offerNextWaitlistSlot(
      row.practitionerId,
      row.clinicId,
      toClinicDateString(row.scheduledStart),
    );
    return row;
  }

  /** Includes the practitioner's name/slug — the list needs to say who each appointment is with, and a "leave a review" link needs the slug. */
  listMyAppointments(callerId: string) {
    return this.db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        subjectType: appointments.subjectType,
        familyMemberId: appointments.familyMemberId,
        practitionerId: appointments.practitionerId,
        practitionerFullName: practitioners.fullName,
        practitionerSlug: practitioners.slug,
        clinicId: appointments.clinicId,
        scheduledStart: appointments.scheduledStart,
        scheduledEnd: appointments.scheduledEnd,
        status: appointments.status,
        cancellationReason: appointments.cancellationReason,
      })
      .from(appointments)
      .innerJoin(
        practitioners,
        eq(practitioners.id, appointments.practitionerId),
      )
      .where(eq(appointments.patientId, callerId))
      .orderBy(desc(appointments.scheduledStart));
  }

  async joinWaitlist(callerId: string, input: JoinWaitlistInput) {
    if (input.subjectType === 'family_member') {
      await this.patientsService.assertFamilyMemberOwnedBy(
        callerId,
        input.familyMemberId!,
      );
    }

    const [row] = await this.db
      .insert(waitlistEntries)
      .values({
        patientId: callerId,
        subjectType: input.subjectType,
        familyMemberId:
          input.subjectType === 'family_member' ? input.familyMemberId : null,
        practitionerId: input.practitionerId,
        clinicId: input.clinicId,
        requestedDate: input.requestedDate,
        status: 'waiting',
      })
      .returning();
    return row;
  }

  /** Includes practitioner/clinic names — same reasoning as listMyAppointments. */
  listMyWaitlistEntries(callerId: string) {
    return this.db
      .select({
        id: waitlistEntries.id,
        subjectType: waitlistEntries.subjectType,
        familyMemberId: waitlistEntries.familyMemberId,
        practitionerId: waitlistEntries.practitionerId,
        practitionerFullName: practitioners.fullName,
        practitionerSlug: practitioners.slug,
        clinicId: waitlistEntries.clinicId,
        clinicName: clinics.name,
        requestedDate: waitlistEntries.requestedDate,
        status: waitlistEntries.status,
        createdAt: waitlistEntries.createdAt,
      })
      .from(waitlistEntries)
      .innerJoin(
        practitioners,
        eq(practitioners.id, waitlistEntries.practitionerId),
      )
      .innerJoin(clinics, eq(clinics.id, waitlistEntries.clinicId))
      .where(eq(waitlistEntries.patientId, callerId))
      .orderBy(desc(waitlistEntries.createdAt));
  }

  /** Withdraws a waitlist entry — the patient booked elsewhere, or no longer wants it. */
  async leaveWaitlist(
    callerId: string,
    waitlistEntryId: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(waitlistEntries)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(waitlistEntries.id, waitlistEntryId),
          eq(waitlistEntries.patientId, callerId),
          inArray(waitlistEntries.status, ['waiting', 'offered']),
        ),
      )
      .returning({ id: waitlistEntries.id });
    if (!row) {
      throw new NotFoundException('Waitlist entry not found');
    }
  }

  /**
   * Offers a just-freed date to the longest-waiting patient for it —
   * "notified when a slot frees up" per the product doc. This only offers
   * (marks the entry 'offered' and notifies); the patient still has to book
   * it themselves through the normal flow like anyone else. Doesn't hold
   * or reserve the slot — a real reservation window is future work.
   */
  private async offerNextWaitlistSlot(
    practitionerId: string,
    clinicId: string,
    freedDate: string,
  ): Promise<void> {
    const [entry] = await this.db
      .select()
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.practitionerId, practitionerId),
          eq(waitlistEntries.clinicId, clinicId),
          eq(waitlistEntries.requestedDate, freedDate),
          eq(waitlistEntries.status, 'waiting'),
        ),
      )
      .orderBy(asc(waitlistEntries.createdAt))
      .limit(1);
    if (!entry) return;

    await this.db
      .update(waitlistEntries)
      .set({ status: 'offered' })
      .where(eq(waitlistEntries.id, entry.id));

    // Awaited: Vercel can freeze the function once the response is sent.
    await this.eventEmitter.emitAsync(
      EVENT_WAITLIST_OFFERED,
      new WaitlistOfferedEvent(
        entry.id,
        entry.patientId,
        practitionerId,
        clinicId,
        freedDate,
      ),
    );
  }

  private async getAppointmentOrThrow(appointmentId: string) {
    const [row] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Appointment not found');
    }
    return row;
  }

  private wrongStatus(
    action: 'cancel' | 'reschedule',
    status: string,
  ): ConflictException {
    return new ConflictException(
      `Cannot ${action} an appointment with status "${status}"`,
    );
  }

  /**
   * The clinic's cancellation window applies to patients only — clinic staff
   * can act any time (e.g. doctor emergency). It covers rescheduling too:
   * otherwise moving a visit out and then cancelling it would get around it.
   * See product doc 3.2 and practitioner_clinic.cancellation_window_hours.
   */
  private async assertOutsideCancellationWindow(appointment: {
    practitionerId: string;
    clinicId: string;
    scheduledStart: Date;
  }): Promise<void> {
    const [pc] = await this.db
      .select({
        cancellationWindowHours: practitionerClinic.cancellationWindowHours,
      })
      .from(practitionerClinic)
      .where(
        and(
          eq(practitionerClinic.practitionerId, appointment.practitionerId),
          eq(practitionerClinic.clinicId, appointment.clinicId),
        ),
      )
      .limit(1);

    const hoursUntil =
      (appointment.scheduledStart.getTime() - Date.now()) / (60 * 60 * 1000);
    if (pc && hoursUntil < pc.cancellationWindowHours) {
      throw new ForbiddenException(
        `This appointment can no longer be changed — it is within the clinic's ${pc.cancellationWindowHours}-hour cancellation window`,
      );
    }
  }

  /**
   * Returns true if the caller is authorized as clinic staff (as opposed to
   * the owning patient). Booking routes name no clinic, so ClinicRoleGuard
   * never runs for them and this is the only check: the same front-desk
   * staff who may check patients in — owner, or a receptionist who hasn't
   * had that permission revoked. Junior doctors have no such permission.
   */
  private async assertCanManage(
    callerId: string,
    appointment: { patientId: string; clinicId: string },
  ): Promise<boolean> {
    if (appointment.patientId === callerId) {
      return false;
    }
    const [staff] = await this.db
      .select({
        role: clinicStaff.role,
        revokedPermissions: clinicStaff.revokedPermissions,
      })
      .from(clinicStaff)
      .where(
        and(
          eq(clinicStaff.clinicId, appointment.clinicId),
          eq(clinicStaff.userId, callerId),
          eq(clinicStaff.status, 'active'),
          inArray(clinicStaff.role, ['owner', 'receptionist']),
        ),
      )
      .limit(1);
    const allowed =
      staff &&
      (staff.role === 'owner' ||
        !staff.revokedPermissions.includes('checkInPatients'));
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have access to this appointment',
      );
    }
    return true;
  }

  /**
   * Runs `write` only if the slot is one availability would offer right now.
   * The check and the write share a transaction holding a lock on this
   * practitioner at this clinic, so two simultaneous requests can't both see
   * the same slot (or the last place under the daily cap) as free.
   *
   * Everything in here must use `tx`: the pool has a single connection (see
   * DatabaseModule), so a query on `this.db` would wait on itself forever.
   */
  private withOpenSlot<T>(
    params: SlotParams,
    write: (tx: Transaction, scheduledEnd: Date) => Promise<T>,
  ): Promise<T> {
    const lockKey = `${params.practitionerId}:${params.clinicId}`;
    const date = toClinicDateString(params.scheduledStart);
    const start = params.scheduledStart.toISOString();

    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );
      const practice = await this.getPracticeOrThrow(tx, params);
      const [day] = await this.computeAvailability(
        tx,
        practice,
        { fromDate: date, toDate: date },
        params.excludeAppointmentId,
      );
      const slot = day?.slots.find((s) => s.start === start);
      if (!slot) {
        throw new ConflictException('This slot is not available');
      }
      return write(tx, new Date(slot.end));
    });
  }
}
