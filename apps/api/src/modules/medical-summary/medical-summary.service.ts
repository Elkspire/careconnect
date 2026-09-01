import { Inject, Injectable } from '@nestjs/common';
import type { UpsertMedicalSummaryInput } from '@careconnect/validation';
import type { AppointmentSubjectType } from '@careconnect/shared-types';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { medicalSummaries } from '../../common/database/schema';

/**
 * The allergies/conditions/blood-group/active-medications fact sheet — one
 * row per subject (self or a family member), not an accumulating history.
 * Pure data access, no authorization: PatientsService and ClinicService
 * each do their own boundary check (own-subject vs. treated-this-patient)
 * before calling in here, the same way ClinicService calls into
 * VaultService for signed URLs.
 */
@Injectable()
export class MedicalSummaryService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get(
    patientId: string,
    subjectType: AppointmentSubjectType,
    familyMemberId?: string,
  ) {
    const conditions = [
      eq(medicalSummaries.patientId, patientId),
      eq(medicalSummaries.subjectType, subjectType),
      subjectType === 'family_member'
        ? eq(medicalSummaries.familyMemberId, familyMemberId!)
        : isNull(medicalSummaries.familyMemberId),
    ];
    const [row] = await this.db
      .select()
      .from(medicalSummaries)
      .where(and(...conditions))
      .limit(1);
    // null, not 404 — an unset summary is a normal empty state, not an error.
    return row ?? null;
  }

  async upsert(
    patientId: string,
    subjectType: AppointmentSubjectType,
    familyMemberId: string | undefined,
    updatedBy: string,
    input: UpsertMedicalSummaryInput,
  ) {
    const existing = await this.get(patientId, subjectType, familyMemberId);
    if (existing) {
      const [row] = await this.db
        .update(medicalSummaries)
        .set({ ...input, updatedBy, updatedAt: new Date() })
        .where(eq(medicalSummaries.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(medicalSummaries)
      .values({
        patientId,
        subjectType,
        familyMemberId: subjectType === 'family_member' ? familyMemberId : null,
        ...input,
        updatedBy,
      })
      .returning();
    return row;
  }
}
