import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CheckInAppointmentInput,
  CreateClinicInput,
  CreatePractitionerLeaveInput,
  InviteReceptionistInput,
  UpsertPractitionerClinicInput,
} from '@careconnect/validation';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, gte, inArray, lt, max, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  authUsers,
  clinicStaff,
  clinics,
  patients,
  practitionerClinic,
  practitionerLeave,
} from '../../common/database/schema';
import {
  EVENT_PATIENT_CHECKED_IN,
  PatientCheckedInEvent,
} from '../notifications/events';
import { slugify } from '../../common/util/slug';

@Injectable()
export class ClinicService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createClinic(ownerPractitionerId: string, input: CreateClinicInput) {
    const [row] = await this.db
      .insert(clinics)
      .values({ ownerPractitionerId, slug: slugify(input.name), ...input })
      .returning();
    return row;
  }

  listMyClinics(ownerPractitionerId: string) {
    return this.db
      .select()
      .from(clinics)
      .where(eq(clinics.ownerPractitionerId, ownerPractitionerId));
  }

  async upsertPractitionerConfig(
    practitionerId: string,
    clinicId: string,
    input: UpsertPractitionerClinicInput,
  ) {
    // clinicId comes from the route param (already guard-verified), not
    // input.clinicId — the schema's clinicId field is redundant here.
    const { clinicId: _ignored, consultationFee, ...rest } = input;
    const values = { ...rest, consultationFee: String(consultationFee) };

    const [row] = await this.db
      .insert(practitionerClinic)
      .values({ practitionerId, clinicId, ...values })
      .onConflictDoUpdate({
        target: [
          practitionerClinic.practitionerId,
          practitionerClinic.clinicId,
        ],
        set: values,
      })
      .returning();
    return row;
  }

  async addLeave(practitionerId: string, input: CreatePractitionerLeaveInput) {
    const [row] = await this.db
      .insert(practitionerLeave)
      .values({ practitionerId, ...input })
      .returning();
    return row;
  }

  /**
   * Staff must already have a Supabase account (found by phone) — this app
   * has no server-side user-creation flow yet, so a clinic can only invite
   * someone who has signed in to CareConnect at least once. A real
   * pending-invite/SMS flow is future work tied to the M7 notifications module.
   */
  async inviteStaff(
    clinicId: string,
    invitedBy: string,
    input: InviteReceptionistInput,
  ) {
    const [user] = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.phone, input.phone))
      .limit(1);
    if (!user) {
      throw new NotFoundException(
        'No CareConnect account found for this phone number yet — ask them to sign in to the app first',
      );
    }

    const [row] = await this.db
      .insert(clinicStaff)
      .values({
        clinicId,
        userId: user.id,
        role: input.role,
        status: 'active',
        invitedBy,
      })
      .onConflictDoUpdate({
        target: [clinicStaff.clinicId, clinicStaff.userId],
        set: { role: input.role, status: 'active' },
      })
      .returning();
    return row;
  }

  listStaff(clinicId: string) {
    return this.db
      .select()
      .from(clinicStaff)
      .where(eq(clinicStaff.clinicId, clinicId));
  }

  async revokeStaff(clinicId: string, staffId: string): Promise<void> {
    const [row] = await this.db
      .update(clinicStaff)
      .set({ status: 'revoked' })
      .where(
        and(eq(clinicStaff.id, staffId), eq(clinicStaff.clinicId, clinicId)),
      )
      .returning({ id: clinicStaff.id });
    if (!row) {
      throw new NotFoundException('Staff member not found at this clinic');
    }
  }

  /**
   * Non-clinical patient list: name, phone, last visit only. No diagnosis,
   * notes, or prescriptions — a receptionist reads this same endpoint, and
   * clinical_notes is a physically separate table this query never touches.
   */
  listPatients(clinicId: string) {
    return this.db
      .select({
        patientId: patients.id,
        fullName: patients.fullName,
        phone: authUsers.phone,
        lastVisit: max(appointments.scheduledStart),
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .where(eq(appointments.clinicId, clinicId))
      .groupBy(patients.id, patients.fullName, authUsers.phone)
      .orderBy(desc(max(appointments.scheduledStart)));
  }

  /**
   * Today's appointment list — the clinic dashboard's default landing
   * screen. Only appointments staff still need to act on: cancelled/
   * completed/no-show ones would just clutter the check-in queue with
   * nothing useful to do about them (and a "Check in" button on a
   * cancelled appointment would be actively misleading, not just noise).
   */
  listToday(clinicId: string) {
    const startOfToday = sql<Date>`date_trunc('day', now())`;
    const startOfTomorrow = sql<Date>`date_trunc('day', now()) + interval '1 day'`;

    return this.db
      .select({
        appointmentId: appointments.id,
        scheduledStart: appointments.scheduledStart,
        status: appointments.status,
        patientId: patients.id,
        patientFullName: patients.fullName,
        patientPhone: authUsers.phone,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.scheduledStart, startOfToday),
          lt(appointments.scheduledStart, startOfTomorrow),
          inArray(appointments.status, ['booked', 'checked_in']),
        ),
      )
      .orderBy(appointments.scheduledStart);
  }

  async checkIn(clinicId: string, input: CheckInAppointmentInput) {
    const [appointment] = await this.db
      .select({
        id: appointments.id,
        clinicId: appointments.clinicId,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.id, input.appointmentId))
      .limit(1);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.clinicId !== clinicId) {
      throw new ForbiddenException(
        'This appointment does not belong to this clinic',
      );
    }
    if (appointment.status !== 'booked') {
      throw new BadRequestException(
        `Cannot check in an appointment with status "${appointment.status}"`,
      );
    }

    const [row] = await this.db
      .update(appointments)
      .set({ status: 'checked_in' })
      .where(eq(appointments.id, input.appointmentId))
      .returning();
    if (!row) {
      throw new Error('Update did not return the checked-in appointment');
    }

    this.eventEmitter.emit(
      EVENT_PATIENT_CHECKED_IN,
      new PatientCheckedInEvent({
        appointmentId: row.id,
        patientId: row.patientId,
        practitionerId: row.practitionerId,
        clinicId: row.clinicId,
        scheduledStart: row.scheduledStart,
      }),
    );
    return row;
  }
}
