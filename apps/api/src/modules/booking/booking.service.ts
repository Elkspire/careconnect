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
import { and, desc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  clinicStaff,
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
} from '../notifications/events';
import { PatientsService } from '../patients/patients.service';
import { computeAvailableSlots, type WeeklyTimings } from './availability';

/** Statuses that occupy a slot and therefore block new bookings. */
const ACTIVE_APPOINTMENT_STATUSES = ['booked', 'checked_in'] as const;

@Injectable()
export class BookingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly patientsService: PatientsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAvailability(query: AvailabilityQuery) {
    const [pc] = await this.db
      .select()
      .from(practitionerClinic)
      .where(
        and(
          eq(practitionerClinic.practitionerId, query.practitionerId),
          eq(practitionerClinic.clinicId, query.clinicId),
          eq(practitionerClinic.isActive, true),
        ),
      )
      .limit(1);
    if (!pc) {
      throw new NotFoundException(
        'This practitioner does not practise at this clinic',
      );
    }

    const fromStart = new Date(`${query.fromDate}T00:00:00+05:00`);
    const toEnd = new Date(`${query.toDate}T23:59:59+05:00`);

    const [busy, leave] = await Promise.all([
      this.db
        .select({
          scheduledStart: appointments.scheduledStart,
          scheduledEnd: appointments.scheduledEnd,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.practitionerId, query.practitionerId),
            eq(appointments.clinicId, query.clinicId),
            inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
            gte(appointments.scheduledStart, fromStart),
            lte(appointments.scheduledStart, toEnd),
          ),
        ),
      this.db
        .select({
          startsOn: practitionerLeave.startsOn,
          endsOn: practitionerLeave.endsOn,
        })
        .from(practitionerLeave)
        .where(
          and(
            eq(practitionerLeave.practitionerId, query.practitionerId),
            // clinicId null = leave applies to all of this practitioner's clinics
            or(
              eq(practitionerLeave.clinicId, query.clinicId),
              isNull(practitionerLeave.clinicId),
            ),
          ),
        ),
    ]);

    return computeAvailableSlots({
      timings: pc.timings as WeeklyTimings,
      slotLengthMinutes: pc.slotLengthMinutes,
      dailyPatientCap: pc.dailyPatientCap,
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

    const [pc] = await this.db
      .select()
      .from(practitionerClinic)
      .where(
        and(
          eq(practitionerClinic.practitionerId, input.practitionerId),
          eq(practitionerClinic.clinicId, input.clinicId),
          eq(practitionerClinic.isActive, true),
        ),
      )
      .limit(1);
    if (!pc) {
      throw new NotFoundException(
        'This practitioner does not practise at this clinic',
      );
    }

    const scheduledStart = new Date(input.scheduledStart);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + pc.slotLengthMinutes * 60_000,
    );

    await this.assertSlotFree({
      practitionerId: input.practitionerId,
      clinicId: input.clinicId,
      scheduledStart,
      scheduledEnd,
    });

    const [row] = await this.db
      .insert(appointments)
      .values({
        patientId: callerId,
        subjectType: input.subjectType,
        familyMemberId:
          input.subjectType === 'family_member' ? input.familyMemberId : null,
        practitionerId: input.practitionerId,
        clinicId: input.clinicId,
        scheduledStart,
        scheduledEnd,
        status: 'booked',
        bookedByUserId: callerId,
      })
      .returning();
    if (!row) {
      throw new Error('Insert did not return the new appointment');
    }

    this.eventEmitter.emit(
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
    await this.assertCanManage(callerId, appointment);

    const [pc] = await this.db
      .select({ slotLengthMinutes: practitionerClinic.slotLengthMinutes })
      .from(practitionerClinic)
      .where(
        and(
          eq(practitionerClinic.practitionerId, appointment.practitionerId),
          eq(practitionerClinic.clinicId, appointment.clinicId),
        ),
      )
      .limit(1);
    if (!pc) {
      throw new NotFoundException(
        'Practitioner/clinic configuration not found',
      );
    }

    const scheduledStart = new Date(input.scheduledStart);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + pc.slotLengthMinutes * 60_000,
    );

    await this.assertSlotFree({
      practitionerId: appointment.practitionerId,
      clinicId: appointment.clinicId,
      scheduledStart,
      scheduledEnd,
      excludeAppointmentId: appointment.id,
    });

    const previousStart = appointment.scheduledStart;
    const [row] = await this.db
      .update(appointments)
      .set({ scheduledStart, scheduledEnd })
      .where(eq(appointments.id, appointment.id))
      .returning();
    if (!row) {
      throw new Error('Update did not return the rescheduled appointment');
    }

    this.eventEmitter.emit(
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
    return row;
  }

  async cancelAppointment(callerId: string, input: CancelAppointmentInput) {
    const appointment = await this.getAppointmentOrThrow(input.appointmentId);
    const isStaff = await this.assertCanManage(callerId, appointment);

    // The clinic's cancellation window applies to patient-initiated
    // cancellations only — clinic staff can cancel any time (e.g. doctor
    // emergency). See product doc 3.2 and practitioner_clinic.cancellation_window_hours.
    if (!isStaff) {
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
          `This appointment can no longer be cancelled — it is within the clinic's ${pc.cancellationWindowHours}-hour cancellation window`,
        );
      }
    }

    const [row] = await this.db
      .update(appointments)
      .set({
        status: 'cancelled',
        cancellationReason: input.reason,
        cancelledByUserId: callerId,
        cancelledAt: new Date(),
      })
      .where(eq(appointments.id, appointment.id))
      .returning();
    if (!row) {
      throw new Error('Update did not return the cancelled appointment');
    }

    this.eventEmitter.emit(
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

  listMyWaitlistEntries(callerId: string) {
    return this.db
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.patientId, callerId));
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

  /** Returns true if the caller is authorized as clinic staff (as opposed to the owning patient). */
  private async assertCanManage(
    callerId: string,
    appointment: { patientId: string; clinicId: string },
  ): Promise<boolean> {
    if (appointment.patientId === callerId) {
      return false;
    }
    const [staff] = await this.db
      .select({ id: clinicStaff.id })
      .from(clinicStaff)
      .where(
        and(
          eq(clinicStaff.clinicId, appointment.clinicId),
          eq(clinicStaff.userId, callerId),
          eq(clinicStaff.status, 'active'),
        ),
      )
      .limit(1);
    if (!staff) {
      throw new ForbiddenException(
        'You do not have access to this appointment',
      );
    }
    return true;
  }

  private async assertSlotFree(params: {
    practitionerId: string;
    clinicId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    excludeAppointmentId?: string;
  }): Promise<void> {
    const conditions = [
      eq(appointments.practitionerId, params.practitionerId),
      eq(appointments.clinicId, params.clinicId),
      inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
      lte(appointments.scheduledStart, params.scheduledEnd),
      gte(appointments.scheduledEnd, params.scheduledStart),
    ];
    if (params.excludeAppointmentId) {
      conditions.push(ne(appointments.id, params.excludeAppointmentId));
    }

    const [conflict] = await this.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(...conditions))
      .limit(1);

    if (conflict) {
      throw new ConflictException('This slot is no longer available');
    }
  }
}
