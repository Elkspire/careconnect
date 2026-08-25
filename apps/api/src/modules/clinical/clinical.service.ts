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
import { appointments, clinicalNotes } from '../../common/database/schema';

/**
 * Physically isolated: this is the only module that ever touches
 * clinical_notes. Every query below filters by `practitionerId = callerId`,
 * deliberately mirroring the clinical_notes RLS policy in
 * supabase/migrations/0001_init.sql exactly (`practitioner_id = auth.uid()`,
 * no clinic_staff reference at all) — even though ClinicRoleGuard already
 * restricts the route to the clinic's owner, this is defense-in-depth so a
 * misconfigured guard could never leak another practitioner's notes.
 */
@Injectable()
export class ClinicalService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createNote(callerId: string, input: CreateClinicalNoteInput) {
    const [appointment] = await this.db
      .select({
        practitionerId: appointments.practitionerId,
        patientId: appointments.patientId,
      })
      .from(appointments)
      .where(eq(appointments.id, input.appointmentId))
      .limit(1);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.practitionerId !== callerId) {
      throw new ForbiddenException(
        'You are not the treating practitioner for this appointment',
      );
    }

    const [row] = await this.db
      .insert(clinicalNotes)
      .values({
        appointmentId: input.appointmentId,
        patientId: appointment.patientId,
        practitionerId: callerId,
        notes: input.notes,
        diagnosis: input.diagnosis,
        createdBy: callerId,
      })
      .returning();
    return row;
  }

  async getNote(callerId: string, appointmentId: string) {
    const [row] = await this.db
      .select()
      .from(clinicalNotes)
      .where(
        and(
          eq(clinicalNotes.appointmentId, appointmentId),
          eq(clinicalNotes.practitionerId, callerId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Clinical note not found');
    }
    return row;
  }

  async updateNote(
    callerId: string,
    appointmentId: string,
    input: UpdateClinicalNoteInput,
  ) {
    const [row] = await this.db
      .update(clinicalNotes)
      .set(input)
      .where(
        and(
          eq(clinicalNotes.appointmentId, appointmentId),
          eq(clinicalNotes.practitionerId, callerId),
        ),
      )
      .returning();
    if (!row) {
      throw new NotFoundException('Clinical note not found');
    }
    return row;
  }
}
