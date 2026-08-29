import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateClinicalNoteInput,
  UpdateClinicalNoteInput,
} from '@careconnect/validation';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  clinicalNotes,
  clinicStaff,
} from '../../common/database/schema';

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
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async isActiveJuniorDoctor(
    callerId: string,
    clinicId: string,
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
      !(await this.isActiveJuniorDoctor(callerId, clinicId))
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
      !(await this.isActiveJuniorDoctor(callerId, clinicId))
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
        appointmentClinicId: appointments.clinicId,
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
      !(await this.isActiveJuniorDoctor(callerId, clinicId))
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
}
