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
  InviteStaffInput,
  UpsertMedicalSummaryInput,
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
  familyMembers,
  patientRecords,
  patients,
  practitionerClinic,
  practitionerLeave,
  practitioners,
  waitlistEntries,
} from '../../common/database/schema';
import {
  EVENT_PATIENT_CHECKED_IN,
  PatientCheckedInEvent,
} from '../notifications/events';
import { slugify } from '../../common/util/slug';
import { MedicalSummaryService } from '../medical-summary/medical-summary.service';
import { VaultService } from '../vault/vault.service';

@Injectable()
export class ClinicService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly eventEmitter: EventEmitter2,
    private readonly vaultService: VaultService,
    private readonly medicalSummaryService: MedicalSummaryService,
  ) {}

  /** Shared by every "has this clinic actually treated this patient/family member" gate. */
  private async assertClinicHasTreated(
    clinicId: string,
    patientId: string,
    familyMemberId?: string,
  ): Promise<void> {
    const [hasVisited] = await this.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.patientId, patientId),
          familyMemberId
            ? eq(appointments.familyMemberId, familyMemberId)
            : eq(appointments.subjectType, 'self'),
        ),
      )
      .limit(1);
    if (!hasVisited) {
      throw new NotFoundException(
        familyMemberId
          ? 'Family member not found at this clinic'
          : 'Patient not found at this clinic',
      );
    }
  }

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
    input: InviteStaffInput,
  ) {
    // input.phone is validated E.164 (leading '+'), but Supabase Auth
    // stores auth.users.phone without it — this lookup was never actually
    // matching anything until this normalization was added.
    const normalizedPhone = input.phone.replace(/^\+/, '');
    const [user] = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.phone, normalizedPhone))
      .limit(1);
    if (!user) {
      throw new NotFoundException(
        'No CareConnect account found for this phone number yet — ask them to sign in to the app first',
      );
    }

    // A junior doctor co-authors clinical notes under this clinic (see
    // ClinicalService), which requires a real practitioner profile — catch
    // the mismatch here with a clear message instead of a raw FK error
    // later when they try to write their first note.
    if (input.role === 'junior_doctor') {
      const [practitioner] = await this.db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(eq(practitioners.id, user.id))
        .limit(1);
      if (!practitioner) {
        throw new BadRequestException(
          'This phone number has no practitioner profile yet — a junior doctor must have signed up as a practitioner first',
        );
      }
    }

    const [row] = await this.db
      .insert(clinicStaff)
      .values({
        clinicId,
        userId: user.id,
        role: input.role,
        status: 'active',
        invitedBy,
        revokedPermissions: input.deniedPermissions,
      })
      .onConflictDoUpdate({
        target: [clinicStaff.clinicId, clinicStaff.userId],
        set: {
          role: input.role,
          status: 'active',
          revokedPermissions: input.deniedPermissions,
        },
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
   *
   * Each family member a patient has booked for at this clinic gets its
   * own row (grouped by familyMemberId, which is NULL — one group — for
   * the patient's own visits) rather than being folded into the patient's
   * own row, so a family member shows up as a distinct patient to staff.
   */
  async listPatients(clinicId: string) {
    const rows = await this.db
      .select({
        patientId: patients.id,
        guardianFullName: patients.fullName,
        phone: authUsers.phone,
        familyMemberId: appointments.familyMemberId,
        familyMemberFullName: familyMembers.fullName,
        lastVisit: max(appointments.scheduledStart),
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .leftJoin(
        familyMembers,
        eq(familyMembers.id, appointments.familyMemberId),
      )
      .where(eq(appointments.clinicId, clinicId))
      .groupBy(
        patients.id,
        patients.fullName,
        authUsers.phone,
        appointments.familyMemberId,
        familyMembers.fullName,
      )
      .orderBy(desc(max(appointments.scheduledStart)));

    return rows.map((row) => ({
      patientId: row.patientId,
      familyMemberId: row.familyMemberId,
      fullName: row.familyMemberFullName ?? row.guardianFullName,
      guardianFullName: row.familyMemberId ? row.guardianFullName : null,
      phone: row.phone,
      lastVisit: row.lastVisit,
    }));
  }

  /**
   * Single patient's non-clinical detail + this clinic's appointment
   * history with them (their own visits only — a family member they've
   * booked for gets their own detail page via getFamilyMemberDetail).
   * Same boundary as listPatients — no diagnosis, notes, or
   * prescriptions — and the patient must have at least one appointment
   * at this clinic (no browsing arbitrary patient IDs).
   */
  async getPatientDetail(clinicId: string, patientId: string) {
    const [patient] = await this.db
      .select({
        patientId: patients.id,
        fullName: patients.fullName,
        phone: authUsers.phone,
        email: patients.email,
        gender: patients.gender,
        dob: patients.dob,
      })
      .from(patients)
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .innerJoin(
        appointments,
        and(
          eq(appointments.patientId, patients.id),
          eq(appointments.clinicId, clinicId),
          eq(appointments.subjectType, 'self'),
        ),
      )
      .where(eq(patients.id, patientId))
      .limit(1);
    if (!patient) {
      throw new NotFoundException('Patient not found at this clinic');
    }

    const history = await this.db
      .select({
        appointmentId: appointments.id,
        scheduledStart: appointments.scheduledStart,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.patientId, patientId),
          eq(appointments.subjectType, 'self'),
        ),
      )
      .orderBy(desc(appointments.scheduledStart));

    const familyMembersAtClinic = await this.db
      .select({
        familyMemberId: familyMembers.id,
        fullName: familyMembers.fullName,
        lastVisit: max(appointments.scheduledStart),
      })
      .from(appointments)
      .innerJoin(
        familyMembers,
        eq(familyMembers.id, appointments.familyMemberId),
      )
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.patientId, patientId),
          eq(appointments.subjectType, 'family_member'),
        ),
      )
      .groupBy(familyMembers.id, familyMembers.fullName)
      .orderBy(desc(max(appointments.scheduledStart)));

    return {
      patient,
      appointments: history,
      familyMembers: familyMembersAtClinic,
    };
  }

  /**
   * A family member's own detail page — same non-clinical shape as
   * getPatientDetail, scoped to appointments booked for them specifically
   * at this clinic. Contact info still comes from the guardian patient,
   * since family members have no login/phone of their own.
   */
  async getFamilyMemberDetail(
    clinicId: string,
    patientId: string,
    familyMemberId: string,
  ) {
    const [familyMember] = await this.db
      .select({
        familyMemberId: familyMembers.id,
        fullName: familyMembers.fullName,
        relationship: familyMembers.relationship,
        gender: familyMembers.gender,
        dob: familyMembers.dob,
        guardianPatientId: patients.id,
        guardianFullName: patients.fullName,
        guardianPhone: authUsers.phone,
      })
      .from(familyMembers)
      .innerJoin(patients, eq(patients.id, familyMembers.patientId))
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .innerJoin(
        appointments,
        and(
          eq(appointments.familyMemberId, familyMembers.id),
          eq(appointments.clinicId, clinicId),
        ),
      )
      .where(
        and(
          eq(familyMembers.id, familyMemberId),
          eq(familyMembers.patientId, patientId),
        ),
      )
      .limit(1);
    if (!familyMember) {
      throw new NotFoundException('Family member not found at this clinic');
    }

    const history = await this.db
      .select({
        appointmentId: appointments.id,
        scheduledStart: appointments.scheduledStart,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.familyMemberId, familyMemberId),
        ),
      )
      .orderBy(desc(appointments.scheduledStart));

    return { familyMember, appointments: history };
  }

  /**
   * All of a patient's (or, scoped separately below, a family member's)
   * vault records — not just ones linked to a specific appointment. Any
   * clinic the patient has visited can see everything in their record
   * type list (prescriptions, lab reports, other documents), same as a
   * real clinic front desk pulling a patient's file. Owner only, same
   * sensitivity as clinical_notes.
   */
  async getPatientRecords(clinicId: string, patientId: string) {
    await this.assertClinicHasTreated(clinicId, patientId);

    return this.db
      .select({
        id: patientRecords.id,
        fileName: patientRecords.fileName,
        recordType: patientRecords.recordType,
        mimeType: patientRecords.mimeType,
        linkedAppointmentId: patientRecords.linkedAppointmentId,
        createdAt: patientRecords.createdAt,
      })
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.patientId, patientId),
          eq(patientRecords.subjectType, 'self'),
        ),
      )
      .orderBy(desc(patientRecords.createdAt));
  }

  async getFamilyMemberRecords(
    clinicId: string,
    patientId: string,
    familyMemberId: string,
  ) {
    await this.assertClinicHasTreated(clinicId, patientId, familyMemberId);

    return this.db
      .select({
        id: patientRecords.id,
        fileName: patientRecords.fileName,
        recordType: patientRecords.recordType,
        mimeType: patientRecords.mimeType,
        linkedAppointmentId: patientRecords.linkedAppointmentId,
        createdAt: patientRecords.createdAt,
      })
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.patientId, patientId),
          eq(patientRecords.familyMemberId, familyMemberId),
        ),
      )
      .orderBy(desc(patientRecords.createdAt));
  }

  async getRecordSignedUrl(
    clinicId: string,
    recordId: string,
  ): Promise<{ url: string }> {
    const [record] = await this.db
      .select({
        patientId: patientRecords.patientId,
        subjectType: patientRecords.subjectType,
        familyMemberId: patientRecords.familyMemberId,
      })
      .from(patientRecords)
      .where(eq(patientRecords.id, recordId))
      .limit(1);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    const subjectCondition =
      record.subjectType === 'family_member' && record.familyMemberId
        ? eq(appointments.familyMemberId, record.familyMemberId)
        : eq(appointments.subjectType, 'self');
    const [hasVisited] = await this.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.patientId, record.patientId),
          subjectCondition,
        ),
      )
      .limit(1);
    if (!hasVisited) {
      throw new NotFoundException('Record not found at this clinic');
    }
    return this.vaultService.getSignedUrlForRecordUnchecked(recordId);
  }

  /**
   * Allergies/conditions/blood-group/active-medications — read/write for
   * any clinic that's actually treated this patient, gated one notch
   * tighter than the plain record list (owner/junior_doctor's
   * 'clinicalNotes' permission for writes, not just 'viewRecords'), since
   * editing someone's allergy list is clinical judgment, not just viewing
   * a file.
   */
  async getPatientMedicalSummary(clinicId: string, patientId: string) {
    await this.assertClinicHasTreated(clinicId, patientId);
    return this.medicalSummaryService.get(patientId, 'self');
  }

  async upsertPatientMedicalSummary(
    clinicId: string,
    patientId: string,
    updatedBy: string,
    input: UpsertMedicalSummaryInput,
  ) {
    await this.assertClinicHasTreated(clinicId, patientId);
    return this.medicalSummaryService.upsert(
      patientId,
      'self',
      undefined,
      updatedBy,
      input,
    );
  }

  async getFamilyMemberMedicalSummary(
    clinicId: string,
    patientId: string,
    familyMemberId: string,
  ) {
    await this.assertClinicHasTreated(clinicId, patientId, familyMemberId);
    return this.medicalSummaryService.get(
      patientId,
      'family_member',
      familyMemberId,
    );
  }

  async upsertFamilyMemberMedicalSummary(
    clinicId: string,
    patientId: string,
    familyMemberId: string,
    updatedBy: string,
    input: UpsertMedicalSummaryInput,
  ) {
    await this.assertClinicHasTreated(clinicId, patientId, familyMemberId);
    return this.medicalSummaryService.upsert(
      patientId,
      'family_member',
      familyMemberId,
      updatedBy,
      input,
    );
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

  /**
   * Patients waiting for a slot to free up at this clinic — the front-desk
   * "someone is calling, nothing suits, put them on the list" screen. Only
   * still-active entries (waiting/offered); converted/expired/cancelled
   * ones are done, cluttering the desk view with nothing to act on.
   */
  listClinicWaitlist(clinicId: string) {
    return this.db
      .select({
        id: waitlistEntries.id,
        practitionerId: waitlistEntries.practitionerId,
        practitionerFullName: practitioners.fullName,
        patientId: patients.id,
        patientFullName: patients.fullName,
        patientPhone: authUsers.phone,
        subjectType: waitlistEntries.subjectType,
        familyMemberFullName: familyMembers.fullName,
        requestedDate: waitlistEntries.requestedDate,
        status: waitlistEntries.status,
        createdAt: waitlistEntries.createdAt,
      })
      .from(waitlistEntries)
      .innerJoin(
        practitioners,
        eq(practitioners.id, waitlistEntries.practitionerId),
      )
      .innerJoin(patients, eq(patients.id, waitlistEntries.patientId))
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .leftJoin(
        familyMembers,
        eq(familyMembers.id, waitlistEntries.familyMemberId),
      )
      .where(
        and(
          eq(waitlistEntries.clinicId, clinicId),
          inArray(waitlistEntries.status, ['waiting', 'offered']),
        ),
      )
      .orderBy(waitlistEntries.requestedDate, waitlistEntries.createdAt);
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
