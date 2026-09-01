import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateClinicalNoteInput,
  SavePrescriptionInput,
  UpdateClinicalNoteInput,
} from '@careconnect/validation';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  clinicalNotes,
  clinics,
  clinicStaff,
  familyMembers,
  patientAssignments,
  practitioners,
  prescriptionItems,
} from '../../common/database/schema';
import { MedicalSummaryService } from '../medical-summary/medical-summary.service';

/**
 * Physically isolated: this is the only module that ever touches
 * clinical_notes. Access is granted to exactly two people: the appointment's
 * treating practitioner (`practitioner_id`, mirroring the clinical_notes RLS
 * policy in supabase/migrations/0001_init.sql exactly — no clinic_staff
 * reference there at all), or an active `junior_doctor` clinic_staff member
 * of the clinic the appointment belongs to (a co-author, per product doc
 * section 3.5 — "owner co-signs if the clinic requires it"). A note always
 * keeps `practitionerId` as the treating doctor regardless of who wrote it;
 * `createdBy` records the actual author, so the owner always sees notes
 * written by their junior doctors as part of their own patients' records.
 * ClinicRoleGuard already restricts the route to owner/junior_doctor before
 * any of this runs — this is defense-in-depth so a misconfigured guard
 * could never leak another clinic's or practitioner's notes.
 */
@Injectable()
export class ClinicalService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly medicalSummaryService: MedicalSummaryService,
  ) {}

  /**
   * "A junior doctor sees the patients assigned to them, not the whole
   * practice" applies here too, not just the non-clinical patient list in
   * ClinicService — otherwise any active junior doctor at the clinic could
   * co-author/read notes and prescriptions for a patient they were never
   * assigned, which is a bigger exposure than the patient-list gap it would
   * leave inconsistent with. Mirrors patient_assignments the same way
   * ClinicService.assertClinicHasTreated does.
   */
  private async isAssignedJuniorDoctor(
    callerId: string,
    clinicId: string,
    patientId: string,
    familyMemberId?: string | null,
  ): Promise<boolean> {
    const [staffRow] = await this.db
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
    if (!staffRow) {
      return false;
    }
    const [assignmentRow] = await this.db
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
    return !!assignmentRow;
  }

  async createNote(
    callerId: string,
    clinicId: string,
    input: CreateClinicalNoteInput,
  ) {
    const [appointment] = await this.db
      .select({
        practitionerId: appointments.practitionerId,
        patientId: appointments.patientId,
        clinicId: appointments.clinicId,
        familyMemberId: appointments.familyMemberId,
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
    const isTreatingPractitioner = appointment.practitionerId === callerId;
    if (
      !isTreatingPractitioner &&
      !(await this.isAssignedJuniorDoctor(
        callerId,
        clinicId,
        appointment.patientId,
        appointment.familyMemberId,
      ))
    ) {
      throw new ForbiddenException(
        'You are not the treating practitioner for this appointment',
      );
    }

    const [row] = await this.db
      .insert(clinicalNotes)
      .values({
        appointmentId: input.appointmentId,
        patientId: appointment.patientId,
        practitionerId: appointment.practitionerId,
        notes: input.notes,
        diagnosis: input.diagnosis,
        createdBy: callerId,
      })
      .returning();
    return row;
  }

  async getNote(callerId: string, clinicId: string, appointmentId: string) {
    const [row] = await this.db
      .select({
        note: clinicalNotes,
        appointmentClinicId: appointments.clinicId,
        familyMemberId: appointments.familyMemberId,
      })
      .from(clinicalNotes)
      .innerJoin(appointments, eq(appointments.id, clinicalNotes.appointmentId))
      .where(eq(clinicalNotes.appointmentId, appointmentId))
      .limit(1);
    if (!row || row.appointmentClinicId !== clinicId) {
      throw new NotFoundException('Clinical note not found');
    }
    if (
      row.note.practitionerId !== callerId &&
      !(await this.isAssignedJuniorDoctor(
        callerId,
        clinicId,
        row.note.patientId,
        row.familyMemberId,
      ))
    ) {
      throw new NotFoundException('Clinical note not found');
    }
    return row.note;
  }

  async updateNote(
    callerId: string,
    clinicId: string,
    appointmentId: string,
    input: UpdateClinicalNoteInput,
  ) {
    const [existing] = await this.db
      .select({
        practitionerId: clinicalNotes.practitionerId,
        patientId: clinicalNotes.patientId,
        appointmentClinicId: appointments.clinicId,
        familyMemberId: appointments.familyMemberId,
      })
      .from(clinicalNotes)
      .innerJoin(appointments, eq(appointments.id, clinicalNotes.appointmentId))
      .where(eq(clinicalNotes.appointmentId, appointmentId))
      .limit(1);
    if (!existing || existing.appointmentClinicId !== clinicId) {
      throw new NotFoundException('Clinical note not found');
    }
    if (
      existing.practitionerId !== callerId &&
      !(await this.isAssignedJuniorDoctor(
        callerId,
        clinicId,
        existing.patientId,
        existing.familyMemberId,
      ))
    ) {
      throw new NotFoundException('Clinical note not found');
    }

    const [row] = await this.db
      .update(clinicalNotes)
      .set(input)
      .where(eq(clinicalNotes.appointmentId, appointmentId))
      .returning();
    if (!row) {
      throw new NotFoundException('Clinical note not found');
    }
    return row;
  }

  /**
   * A patient reading their own visit history — the "every doctor I visit
   * adds their note to my file, so my history builds itself" half of the
   * patient-owns-the-record principle. Deliberately a different access
   * shape than everything else in this file (filtered by patientId, not
   * practitionerId/junior-doctor membership): a patient has always been
   * allowed to see what's written about them, this is just the first
   * place that actually exposes it. clinical_notes itself never leaves
   * this module — the route only returns the fields below.
   */
  async listMyHistory(patientId: string) {
    const visits = await this.db
      .select({
        noteId: clinicalNotes.id,
        appointmentId: clinicalNotes.appointmentId,
        notes: clinicalNotes.notes,
        diagnosis: clinicalNotes.diagnosis,
        createdAt: clinicalNotes.createdAt,
        subjectType: appointments.subjectType,
        familyMemberFullName: familyMembers.fullName,
        practitionerFullName: practitioners.fullName,
        clinicName: clinics.name,
        scheduledStart: appointments.scheduledStart,
      })
      .from(clinicalNotes)
      .innerJoin(appointments, eq(appointments.id, clinicalNotes.appointmentId))
      .innerJoin(
        practitioners,
        eq(practitioners.id, clinicalNotes.practitionerId),
      )
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .leftJoin(
        familyMembers,
        eq(familyMembers.id, appointments.familyMemberId),
      )
      .where(eq(clinicalNotes.patientId, patientId))
      .orderBy(desc(appointments.scheduledStart));
    if (visits.length === 0) {
      return [];
    }

    const items = await this.db
      .select({
        clinicalNoteId: prescriptionItems.clinicalNoteId,
        drugName: prescriptionItems.drugName,
        dosage: prescriptionItems.dosage,
        frequency: prescriptionItems.frequency,
        duration: prescriptionItems.duration,
        instructions: prescriptionItems.instructions,
      })
      .from(prescriptionItems)
      .where(
        inArray(
          prescriptionItems.clinicalNoteId,
          visits.map((v) => v.noteId),
        ),
      )
      .orderBy(asc(prescriptionItems.sortOrder));
    const itemsByNoteId = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByNoteId.get(item.clinicalNoteId) ?? [];
      list.push(item);
      itemsByNoteId.set(item.clinicalNoteId, list);
    }

    return visits.map(({ noteId, ...visit }) => ({
      ...visit,
      prescriptionItems: itemsByNoteId.get(noteId) ?? [],
    }));
  }

  /**
   * The patient's (or family member's) recorded allergies for this
   * appointment — shown at the top of the clinical-notes page so a
   * prescriber sees them before writing, not just as a post-save keyword
   * check. Appointment-level, not note-level, since a doctor needs this
   * before any note/prescription exists yet.
   */
  async getAppointmentAllergies(
    callerId: string,
    clinicId: string,
    appointmentId: string,
  ): Promise<string[]> {
    const [appt] = await this.db
      .select({
        practitionerId: appointments.practitionerId,
        clinicId: appointments.clinicId,
        patientId: appointments.patientId,
        subjectType: appointments.subjectType,
        familyMemberId: appointments.familyMemberId,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appt || appt.clinicId !== clinicId) {
      throw new NotFoundException('Appointment not found');
    }
    if (
      appt.practitionerId !== callerId &&
      !(await this.isAssignedJuniorDoctor(
        callerId,
        clinicId,
        appt.patientId,
        appt.familyMemberId,
      ))
    ) {
      throw new ForbiddenException(
        'You are not the treating practitioner for this appointment',
      );
    }

    const summary = await this.medicalSummaryService.get(
      appt.patientId,
      appt.subjectType,
      appt.familyMemberId ?? undefined,
    );
    return summary?.allergies ?? [];
  }

  /** Shared by savePrescription/getPrescription: find the note + the same owner/junior-doctor check as everywhere else in this file. */
  private async getAuthorizedNote(
    callerId: string,
    clinicId: string,
    appointmentId: string,
  ) {
    const [row] = await this.db
      .select({
        note: clinicalNotes,
        appointmentClinicId: appointments.clinicId,
        subjectType: appointments.subjectType,
        familyMemberId: appointments.familyMemberId,
      })
      .from(clinicalNotes)
      .innerJoin(appointments, eq(appointments.id, clinicalNotes.appointmentId))
      .where(eq(clinicalNotes.appointmentId, appointmentId))
      .limit(1);
    if (!row || row.appointmentClinicId !== clinicId) {
      throw new NotFoundException('Clinical note not found');
    }
    if (
      row.note.practitionerId !== callerId &&
      !(await this.isAssignedJuniorDoctor(
        callerId,
        clinicId,
        row.note.patientId,
        row.familyMemberId,
      ))
    ) {
      throw new NotFoundException('Clinical note not found');
    }
    return row;
  }

  private getPrescriptionItems(clinicalNoteId: string) {
    return this.db
      .select({
        id: prescriptionItems.id,
        drugName: prescriptionItems.drugName,
        dosage: prescriptionItems.dosage,
        frequency: prescriptionItems.frequency,
        duration: prescriptionItems.duration,
        instructions: prescriptionItems.instructions,
      })
      .from(prescriptionItems)
      .where(eq(prescriptionItems.clinicalNoteId, clinicalNoteId))
      .orderBy(asc(prescriptionItems.sortOrder));
  }

  async getPrescription(
    callerId: string,
    clinicId: string,
    appointmentId: string,
  ) {
    const { note } = await this.getAuthorizedNote(
      callerId,
      clinicId,
      appointmentId,
    );
    return this.getPrescriptionItems(note.id);
  }

  /**
   * Replaces the whole prescription for a visit. Flags drug names that
   * match the patient's (or family member's, matching the appointment's
   * own subject) recorded allergy list from medical_summaries — a plain
   * case-insensitive keyword match, *not* a real drug-interaction/
   * cross-reactivity check (that needs a real pharmacology database, e.g.
   * knowing "Augmentin" contains a penicillin — out of scope here).
   * Informational, not a submission block: the web form requires the
   * prescriber to confirm they've reviewed the allergies shown alongside
   * it (a human-review gate) rather than trusting an automated keyword
   * match to be authoritative — see savePrescriptionSchema's doc comment.
   */
  async savePrescription(
    callerId: string,
    clinicId: string,
    appointmentId: string,
    input: SavePrescriptionInput,
  ) {
    const { note, subjectType, familyMemberId } = await this.getAuthorizedNote(
      callerId,
      clinicId,
      appointmentId,
    );

    const summary = await this.medicalSummaryService.get(
      note.patientId,
      subjectType,
      familyMemberId ?? undefined,
    );
    const allergies = summary?.allergies ?? [];
    const allergyWarnings = input.items
      .filter((item) =>
        allergies.some((allergy) => {
          const drug = item.drugName.toLowerCase().trim();
          const a = allergy.toLowerCase().trim();
          return drug.includes(a) || a.includes(drug);
        }),
      )
      .map((item) => item.drugName);

    await this.db
      .delete(prescriptionItems)
      .where(eq(prescriptionItems.clinicalNoteId, note.id));
    if (input.items.length > 0) {
      await this.db.insert(prescriptionItems).values(
        input.items.map((item, i) => ({
          clinicalNoteId: note.id,
          ...item,
          sortOrder: i,
        })),
      );
    }
    const items = await this.getPrescriptionItems(note.id);
    return { items, allergyWarnings };
  }
}
