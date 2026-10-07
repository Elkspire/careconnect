import {
  BadRequestException,
  ConflictException,
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
  RecordVitalsInput,
  UpsertMedicalSummaryInput,
  UpsertPractitionerClinicInput,
} from '@careconnect/validation';
import type { RecordType } from '@careconnect/shared-types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  and,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  max,
  sql,
} from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase-admin.module';
import {
  appointments,
  authUsers,
  clinicStaff,
  clinics,
  familyMembers,
  patientAssignments,
  patientRecords,
  patients,
  practitionerClinic,
  practitionerLeave,
  practitioners,
  vitals,
  waitlistEntries,
} from '../../common/database/schema';
import {
  EVENT_PATIENT_CHECKED_IN,
  EVENT_STAFF_INVITED,
  PatientCheckedInEvent,
  StaffInvitedEvent,
} from '../notifications/events';
import { slugify } from '../../common/util/slug';
import { MedicalSummaryService } from '../medical-summary/medical-summary.service';
import { VaultService, type UploadedFile } from '../vault/vault.service';

@Injectable()
export class ClinicService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly eventEmitter: EventEmitter2,
    private readonly vaultService: VaultService,
    private readonly medicalSummaryService: MedicalSummaryService,
  ) {}

  private async isActiveJuniorDoctor(
    clinicId: string,
    callerId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: clinicStaff.id })
      .from(clinicStaff)
      .where(
        and(
          eq(clinicStaff.clinicId, clinicId),
          eq(clinicStaff.userId, callerId),
          eq(clinicStaff.role, 'junior_doctor'),
          eq(clinicStaff.status, 'active'),
        ),
      )
      .limit(1);
    return !!row;
  }

  /**
   * If the caller is an active junior doctor, require a patient_assignments
   * row for this patient/family member — every junior-doctor-reachable
   * action (notes, histories, vitals, attaching records) is scoped to
   * explicitly assigned patients, per the product doc's assignment-scoped
   * design (see 0015_patient_assignments.sql). Owner and receptionist
   * callers never hit this check. Throws `onUnassigned` when scoped and
   * not assigned.
   */
  private async assertJuniorDoctorAssigned(
    clinicId: string,
    callerId: string,
    patientId: string,
    familyMemberId: string | undefined | null,
    onUnassigned: () => Error,
  ): Promise<void> {
    if (!(await this.isActiveJuniorDoctor(clinicId, callerId))) {
      return;
    }
    const [assigned] = await this.db
      .select({ id: patientAssignments.id })
      .from(patientAssignments)
      .where(
        and(
          eq(patientAssignments.clinicId, clinicId),
          eq(patientAssignments.juniorDoctorUserId, callerId),
          eq(patientAssignments.patientId, patientId),
          familyMemberId
            ? eq(patientAssignments.familyMemberId, familyMemberId)
            : isNull(patientAssignments.familyMemberId),
        ),
      )
      .limit(1);
    if (!assigned) {
      throw onUnassigned();
    }
  }

  /**
   * Shared by every "has this clinic actually treated this patient/family
   * member, and — if the caller is a junior doctor — are they specifically
   * assigned to this patient" gate.
   */
  private async assertClinicHasTreated(
    clinicId: string,
    callerId: string,
    patientId: string,
    familyMemberId?: string,
  ): Promise<void> {
    const notFound = () =>
      new NotFoundException(
        familyMemberId
          ? 'Family member not found at this clinic'
          : 'Patient not found at this clinic',
      );

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
      throw notFound();
    }

    await this.assertJuniorDoctorAssigned(
      clinicId,
      callerId,
      patientId,
      familyMemberId,
      notFound,
    );
  }

  /**
   * Also seats the owner as clinic_staff — every /clinic/:clinicSlug/* page
   * and endpoint gates on a clinic_staff row (see resolveClinicStaffBySlug),
   * not on clinics.ownerPractitionerId, so without this an owner could
   * create a clinic and then immediately fail to reach its own dashboard.
   */
  async createClinic(ownerPractitionerId: string, input: CreateClinicInput) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(clinics)
        .values({ ownerPractitionerId, slug: slugify(input.name), ...input })
        .returning();
      if (!row) {
        throw new Error('Clinic insert returned no row');
      }
      await tx.insert(clinicStaff).values({
        clinicId: row.id,
        userId: ownerPractitionerId,
        role: 'owner',
        status: 'active',
      });
      return row;
    });
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
   * Staff don't need an account before being invited — if no Supabase user
   * exists yet for the given phone/email, one is created here (service-role
   * Auth Admin API) so the invite always succeeds. The invitee then just
   * logs in normally at the regular login page; post-login routes them to
   * the clinic dashboard since their clinicStaff row already exists. This
   * replaces the earlier "ask them to sign in first" 404 — there was no
   * self-service "register as receptionist/junior doctor" flow for them to
   * go complete, so that error was a dead end.
   */
  async inviteStaff(
    clinicId: string,
    invitedBy: string,
    input: InviteStaffInput,
  ) {
    // inviteStaffSchema guarantees at least one of phone/email is present.
    // input.phone, when given, is validated E.164 (leading '+'), but
    // Supabase Auth stores auth.users.phone without it. Email lookups use
    // lowercase since Supabase normalizes emails to lowercase on signup.
    const phone = input.phone?.replace(/^\+/, '');
    const email = input.email?.toLowerCase();
    const identifier = [email, input.phone].filter(Boolean).join(' / ');

    // Both are looked up when both are given. Checking only the phone (as
    // this used to) silently ignored the email: a practitioner who signed
    // up by email couldn't be invited as a junior doctor if the owner also
    // typed their phone, and an empty phone-only account got created on
    // the way to the "no practitioner profile" error.
    const [byEmail] = email
      ? await this.db
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.email, email))
          .limit(1)
      : [];
    const [byPhone] = phone
      ? await this.db
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.phone, phone))
          .limit(1)
      : [];
    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      throw new BadRequestException(
        'This email and phone number belong to two different CareConnect accounts — invite using just one of them',
      );
    }

    // Email first: phone login is currently disabled app-wide, so the
    // email is the identifier the invitee can actually sign in with.
    let user = byEmail ?? byPhone;

    // A junior doctor co-authors clinical notes under this clinic (see
    // ClinicalService), which requires a real practitioner profile — catch
    // the mismatch here with a clear message instead of a raw FK error
    // later when they try to write their first note. Checked before any
    // account creation below: a brand-new account can never have a
    // practitioner profile, so creating one would only leave an orphan.
    if (input.role === 'junior_doctor') {
      const [practitioner] = user
        ? await this.db
            .select({ id: practitioners.id })
            .from(practitioners)
            .where(eq(practitioners.id, user.id))
            .limit(1)
        : [];
      if (!practitioner) {
        throw new BadRequestException(
          `No practitioner profile found for ${identifier} — a junior doctor must register as a practitioner first, using the same email or phone`,
        );
      }
    }

    if (!user) {
      // email_confirm/phone_confirm: true — they're trusted by the inviting
      // clinic owner, not self-signed-up, so there's no "confirm your
      // email" step to make them go through before their first OTP login
      // works.
      const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
        ...(email ? { email, email_confirm: true } : {}),
        ...(phone ? { phone, phone_confirm: true } : {}),
        user_metadata: { full_name: input.fullName },
      });
      if (error || !data.user) {
        throw new BadRequestException(
          `Could not create an account for ${identifier}: ${error?.message ?? 'unknown error'}`,
        );
      }
      user = { id: data.user.id };
    }

    const [row] = await this.db
      .insert(clinicStaff)
      .values({
        clinicId,
        userId: user.id,
        role: input.role,
        status: 'active',
        invitedBy,
        fullName: input.fullName,
        revokedPermissions: input.deniedPermissions,
      })
      .onConflictDoUpdate({
        target: [clinicStaff.clinicId, clinicStaff.userId],
        set: {
          role: input.role,
          status: 'active',
          fullName: input.fullName,
          revokedPermissions: input.deniedPermissions,
        },
      })
      .returning();

    this.eventEmitter.emit(
      EVENT_STAFF_INVITED,
      new StaffInvitedEvent(clinicId, user.id, input.role, invitedBy),
    );
    return row;
  }

  /**
   * fullName is resolved here (not just the raw clinic_staff row) so the
   * owner's staff page — and the assignment picker below, which otherwise
   * has nothing but indistinguishable user ids to choose between — can
   * show who's who. Owner/junior_doctor always have a practitioners row
   * (see inviteStaff's check above), which is their real registered name —
   * preferred over the invite-time fullName if both exist. Receptionist/
   * assistant have no practitioners row, so clinicStaff.fullName (set at
   * invite time) is all there is; the phone/email fallback below only
   * fires for the handful of pre-migration rows invited before that column
   * existed.
   */
  listStaff(clinicId: string) {
    return this.db
      .select({
        id: clinicStaff.id,
        clinicId: clinicStaff.clinicId,
        userId: clinicStaff.userId,
        role: clinicStaff.role,
        status: clinicStaff.status,
        revokedPermissions: clinicStaff.revokedPermissions,
        fullName: sql<
          string | null
        >`coalesce(${practitioners.fullName}, ${clinicStaff.fullName})`,
        phone: authUsers.phone,
        email: authUsers.email,
      })
      .from(clinicStaff)
      .leftJoin(practitioners, eq(practitioners.id, clinicStaff.userId))
      .innerJoin(authUsers, eq(authUsers.id, clinicStaff.userId))
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
  async listPatients(clinicId: string, callerId: string) {
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

    // A junior doctor only sees their assigned subset — filtered in JS
    // rather than a SQL join, since a per-row assignment match on a
    // nullable family_member_id is awkward to express as a join condition
    // without risking silently duplicating rows. Both sets are small
    // (one clinic's worth), so this costs nothing that matters.
    let assignedKeys: Set<string> | null = null;
    if (await this.isActiveJuniorDoctor(clinicId, callerId)) {
      const assignments = await this.db
        .select({
          patientId: patientAssignments.patientId,
          familyMemberId: patientAssignments.familyMemberId,
        })
        .from(patientAssignments)
        .where(
          and(
            eq(patientAssignments.clinicId, clinicId),
            eq(patientAssignments.juniorDoctorUserId, callerId),
          ),
        );
      assignedKeys = new Set(
        assignments.map((a) => `${a.patientId}:${a.familyMemberId ?? ''}`),
      );
    }

    return rows
      .filter(
        (row) =>
          !assignedKeys ||
          assignedKeys.has(`${row.patientId}:${row.familyMemberId ?? ''}`),
      )
      .map((row) => ({
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
  async getPatientDetail(
    clinicId: string,
    callerId: string,
    patientId: string,
  ) {
    await this.assertClinicHasTreated(clinicId, callerId, patientId);

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
    callerId: string,
    patientId: string,
    familyMemberId: string,
  ) {
    await this.assertClinicHasTreated(
      clinicId,
      callerId,
      patientId,
      familyMemberId,
    );

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
  async getPatientRecords(
    clinicId: string,
    callerId: string,
    patientId: string,
  ) {
    await this.assertClinicHasTreated(clinicId, callerId, patientId);

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
    callerId: string,
    patientId: string,
    familyMemberId: string,
  ) {
    await this.assertClinicHasTreated(
      clinicId,
      callerId,
      patientId,
      familyMemberId,
    );

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
    callerId: string,
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

    await this.assertClinicHasTreated(
      clinicId,
      callerId,
      record.patientId,
      record.subjectType === 'family_member' && record.familyMemberId
        ? record.familyMemberId
        : undefined,
    );
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
  async getPatientMedicalSummary(
    clinicId: string,
    callerId: string,
    patientId: string,
  ) {
    await this.assertClinicHasTreated(clinicId, callerId, patientId);
    return this.medicalSummaryService.get(patientId, 'self');
  }

  async upsertPatientMedicalSummary(
    clinicId: string,
    patientId: string,
    updatedBy: string,
    input: UpsertMedicalSummaryInput,
  ) {
    await this.assertClinicHasTreated(clinicId, updatedBy, patientId);
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
    callerId: string,
    patientId: string,
    familyMemberId: string,
  ) {
    await this.assertClinicHasTreated(
      clinicId,
      callerId,
      patientId,
      familyMemberId,
    );
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
    await this.assertClinicHasTreated(
      clinicId,
      updatedBy,
      patientId,
      familyMemberId,
    );
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

  /**
   * Owner-only management of the assignment gate itself (see
   * assertClinicHasTreated) — patient names resolved here for display,
   * not returned by the assignment-consuming methods above, which never
   * need the junior doctor's own identity.
   */
  listPatientAssignments(clinicId: string) {
    return this.db
      .select({
        id: patientAssignments.id,
        juniorDoctorUserId: patientAssignments.juniorDoctorUserId,
        juniorDoctorFullName: practitioners.fullName,
        patientId: patientAssignments.patientId,
        patientFullName: patients.fullName,
        familyMemberId: patientAssignments.familyMemberId,
        familyMemberFullName: familyMembers.fullName,
        createdAt: patientAssignments.createdAt,
      })
      .from(patientAssignments)
      .innerJoin(
        practitioners,
        eq(practitioners.id, patientAssignments.juniorDoctorUserId),
      )
      .innerJoin(patients, eq(patients.id, patientAssignments.patientId))
      .leftJoin(
        familyMembers,
        eq(familyMembers.id, patientAssignments.familyMemberId),
      )
      .where(eq(patientAssignments.clinicId, clinicId))
      .orderBy(desc(patientAssignments.createdAt));
  }

  async assignPatient(
    clinicId: string,
    assignedBy: string,
    juniorDoctorUserId: string,
    patientId: string,
    familyMemberId: string | undefined,
  ) {
    const [juniorDoctor] = await this.db
      .select({ id: clinicStaff.id })
      .from(clinicStaff)
      .where(
        and(
          eq(clinicStaff.clinicId, clinicId),
          eq(clinicStaff.userId, juniorDoctorUserId),
          eq(clinicStaff.role, 'junior_doctor'),
          eq(clinicStaff.status, 'active'),
        ),
      )
      .limit(1);
    if (!juniorDoctor) {
      throw new NotFoundException(
        'No active junior doctor with that id at this clinic',
      );
    }
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
    const [existing] = await this.db
      .select({ id: patientAssignments.id })
      .from(patientAssignments)
      .where(
        and(
          eq(patientAssignments.clinicId, clinicId),
          eq(patientAssignments.juniorDoctorUserId, juniorDoctorUserId),
          eq(patientAssignments.patientId, patientId),
          familyMemberId
            ? eq(patientAssignments.familyMemberId, familyMemberId)
            : isNull(patientAssignments.familyMemberId),
        ),
      )
      .limit(1);
    if (existing) {
      throw new ConflictException('Already assigned to this junior doctor');
    }

    const [row] = await this.db
      .insert(patientAssignments)
      .values({
        clinicId,
        juniorDoctorUserId,
        patientId,
        subjectType: familyMemberId ? 'family_member' : 'self',
        familyMemberId: familyMemberId ?? null,
        assignedBy,
      })
      .returning();
    return row;
  }

  async unassignPatient(clinicId: string, assignmentId: string): Promise<void> {
    const [row] = await this.db
      .delete(patientAssignments)
      .where(
        and(
          eq(patientAssignments.id, assignmentId),
          eq(patientAssignments.clinicId, clinicId),
        ),
      )
      .returning({ id: patientAssignments.id });
    if (!row) {
      throw new NotFoundException('Assignment not found');
    }
  }

  /** Shared by recordVitals/getVitals: confirm the appointment is this clinic's. */
  private async getAppointmentForVitals(
    clinicId: string,
    appointmentId: string,
  ) {
    const [appointment] = await this.db
      .select({
        clinicId: appointments.clinicId,
        patientId: appointments.patientId,
        familyMemberId: appointments.familyMemberId,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appointment || appointment.clinicId !== clinicId) {
      throw new NotFoundException('Appointment not found at this clinic');
    }
    return appointment;
  }

  /**
   * One row per appointment — "save vitals" replaces the whole reading,
   * it isn't an append-only log (see the vitals table's own doc comment).
   */
  async recordVitals(
    clinicId: string,
    appointmentId: string,
    recordedBy: string,
    input: RecordVitalsInput,
  ) {
    const appointment = await this.getAppointmentForVitals(
      clinicId,
      appointmentId,
    );
    await this.assertJuniorDoctorAssigned(
      clinicId,
      recordedBy,
      appointment.patientId,
      appointment.familyMemberId,
      () => new NotFoundException('Appointment not found at this clinic'),
    );
    // Only the fields actually present in this save are written — a
    // partial re-save (e.g. correcting just the pulse) must not clear out
    // measurements taken earlier and already saved for this appointment.
    const measurements: Partial<typeof vitals.$inferInsert> = {};
    if (input.systolicMmhg !== undefined)
      measurements.systolicMmhg = input.systolicMmhg;
    if (input.diastolicMmhg !== undefined)
      measurements.diastolicMmhg = input.diastolicMmhg;
    if (input.pulseBpm !== undefined) measurements.pulseBpm = input.pulseBpm;
    if (input.weightKg !== undefined)
      measurements.weightKg = String(input.weightKg);
    if (input.temperatureF !== undefined)
      measurements.temperatureF = String(input.temperatureF);

    const [row] = await this.db
      .insert(vitals)
      .values({ appointmentId, recordedBy, ...measurements })
      .onConflictDoUpdate({
        target: vitals.appointmentId,
        set: { ...measurements, recordedBy, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  /**
   * A junior doctor only sees vitals for a patient assigned to them —
   * same gate as everywhere else in this file (see assertClinicHasTreated).
   * Owner is never scoped by it.
   */
  async getVitals(clinicId: string, callerId: string, appointmentId: string) {
    const appointment = await this.getAppointmentForVitals(
      clinicId,
      appointmentId,
    );
    await this.assertJuniorDoctorAssigned(
      clinicId,
      callerId,
      appointment.patientId,
      appointment.familyMemberId,
      () => new NotFoundException('Appointment not found at this clinic'),
    );
    // "Everything is attributed" (journeys.html) — a disputed reading has
    // a name on it, not just a user id. Left join + phone fallback, same
    // pattern as listStaff above.
    const [row] = await this.db
      .select({
        id: vitals.id,
        appointmentId: vitals.appointmentId,
        systolicMmhg: vitals.systolicMmhg,
        diastolicMmhg: vitals.diastolicMmhg,
        pulseBpm: vitals.pulseBpm,
        weightKg: vitals.weightKg,
        temperatureF: vitals.temperatureF,
        recordedBy: vitals.recordedBy,
        recordedByName: practitioners.fullName,
        recordedByPhone: authUsers.phone,
        createdAt: vitals.createdAt,
        updatedAt: vitals.updatedAt,
      })
      .from(vitals)
      .leftJoin(practitioners, eq(practitioners.id, vitals.recordedBy))
      .innerJoin(authUsers, eq(authUsers.id, vitals.recordedBy))
      .where(eq(vitals.appointmentId, appointmentId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Owner-only practice snapshot: visits/cancellations/no-shows per day,
   * unique patients, and per-practitioner visit share, over a fixed
   * trailing 30-day window (day boundaries are UTC, not clinic-local
   * Pakistan time — a real simplification, not worth a timezone-aware
   * bucketing pass yet). "Estimated revenue" is exactly that: visits ×
   * each practitioner's *current* configured consultationFee, not what
   * was actually charged at the time — appointments don't snapshot a fee,
   * and CareConnect doesn't process payments at all (see the product
   * doc's own open question on the platform's revenue model, which this
   * deliberately doesn't answer). Never present this as collected revenue.
   */
  async getAnalytics(clinicId: string) {
    const since = sql<Date>`date_trunc('day', now()) - interval '29 days'`;
    const dayExpr = sql<string>`date_trunc('day', ${appointments.scheduledStart})`;
    const visitStatuses = sql`(${appointments.status} in ('checked_in', 'completed'))`;

    const [daily, uniquePatientsRow, byPractitioner] = await Promise.all([
      this.db
        .select({
          day: dayExpr,
          visits: sql<number>`count(*) filter (where ${visitStatuses})::int`,
          cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')::int`,
          noShows: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
          estimatedRevenue: sql<string>`coalesce(sum(${practitionerClinic.consultationFee}) filter (where ${visitStatuses}), 0)`,
        })
        .from(appointments)
        .innerJoin(
          practitionerClinic,
          and(
            eq(practitionerClinic.practitionerId, appointments.practitionerId),
            eq(practitionerClinic.clinicId, appointments.clinicId),
          ),
        )
        .where(
          and(
            eq(appointments.clinicId, clinicId),
            gte(appointments.scheduledStart, since),
          ),
        )
        .groupBy(dayExpr)
        .orderBy(dayExpr),

      this.db
        .select({
          count: sql<number>`count(distinct (${appointments.patientId}::text || ':' || coalesce(${appointments.familyMemberId}::text, '')))::int`,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.clinicId, clinicId),
            gte(appointments.scheduledStart, since),
            inArray(appointments.status, ['checked_in', 'completed']),
          ),
        ),

      this.db
        .select({
          practitionerId: appointments.practitionerId,
          practitionerFullName: practitioners.fullName,
          visits: sql<number>`count(*) filter (where ${visitStatuses})::int`,
        })
        .from(appointments)
        .innerJoin(
          practitioners,
          eq(practitioners.id, appointments.practitionerId),
        )
        .where(
          and(
            eq(appointments.clinicId, clinicId),
            gte(appointments.scheduledStart, since),
          ),
        )
        .groupBy(appointments.practitionerId, practitioners.fullName)
        .orderBy(desc(sql`count(*) filter (where ${visitStatuses})`)),
    ]);

    const totals = daily.reduce(
      (acc, d) => ({
        visits: acc.visits + d.visits,
        cancelled: acc.cancelled + d.cancelled,
        noShows: acc.noShows + d.noShows,
        estimatedRevenue: acc.estimatedRevenue + Number(d.estimatedRevenue),
      }),
      { visits: 0, cancelled: 0, noShows: 0, estimatedRevenue: 0 },
    );

    return {
      windowDays: 30,
      daily,
      totals: { ...totals, uniquePatients: uniquePatientsRow[0]?.count ?? 0 },
      byPractitioner,
    };
  }

  /**
   * The picker for attachRecord below — recent visits at this clinic, so
   * staff select "the pending order," not a free-text patient name (see
   * journeys.html, "a lab report came in... matched by the pending echo
   * order, not the name... two similar names, confirm before saving").
   * Same 30-day window as getAnalytics, for no reason other than
   * consistency — a report almost always follows a recent visit. Scoped
   * to assigned patients for a junior doctor caller, same as everywhere
   * else (see assertJuniorDoctorAssigned).
   */
  async listAppointmentsForAttach(clinicId: string, callerId: string) {
    const since = sql<Date>`date_trunc('day', now()) - interval '30 days'`;
    const scoped = await this.isActiveJuniorDoctor(clinicId, callerId);
    return this.db
      .select({
        appointmentId: appointments.id,
        scheduledStart: appointments.scheduledStart,
        patientFullName: patients.fullName,
        familyMemberFullName: familyMembers.fullName,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .leftJoin(
        familyMembers,
        eq(familyMembers.id, appointments.familyMemberId),
      )
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.scheduledStart, since),
          inArray(appointments.status, ['checked_in', 'completed']),
          scoped
            ? exists(
                this.db
                  .select({ id: patientAssignments.id })
                  .from(patientAssignments)
                  .where(
                    and(
                      eq(patientAssignments.clinicId, clinicId),
                      eq(patientAssignments.juniorDoctorUserId, callerId),
                      eq(patientAssignments.patientId, appointments.patientId),
                      sql`${patientAssignments.familyMemberId} is not distinct from ${appointments.familyMemberId}`,
                    ),
                  ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(appointments.scheduledStart));
  }

  /** Verifies the appointment is this clinic's, then applies the same assignment scoping as everywhere else, before handing off to VaultService — the actual attribution/storage logic lives there, shared with nothing else here. */
  async attachRecord(
    clinicId: string,
    attachedBy: string,
    appointmentId: string,
    recordType: RecordType,
    file: UploadedFile,
  ) {
    const [appointment] = await this.db
      .select({
        clinicId: appointments.clinicId,
        patientId: appointments.patientId,
        familyMemberId: appointments.familyMemberId,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appointment || appointment.clinicId !== clinicId) {
      throw new NotFoundException('Appointment not found at this clinic');
    }
    await this.assertJuniorDoctorAssigned(
      clinicId,
      attachedBy,
      appointment.patientId,
      appointment.familyMemberId,
      () => new NotFoundException('Appointment not found at this clinic'),
    );
    return this.vaultService.attachRecord(
      appointmentId,
      attachedBy,
      recordType,
      file,
    );
  }
}
