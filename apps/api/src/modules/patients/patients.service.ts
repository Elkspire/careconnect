import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddFamilyMemberInput,
  UpdateFamilyMemberInput,
  UpdatePatientProfileInput,
} from '@careconnect/validation';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { familyMembers, patients } from '../../common/database/schema';

@Injectable()
export class PatientsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async upsertProfile(userId: string, input: UpdatePatientProfileInput) {
    const [row] = await this.db
      .insert(patients)
      .values({ id: userId, ...input })
      .onConflictDoUpdate({ target: patients.id, set: input })
      .returning();
    return row;
  }

  async getProfile(userId: string) {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(eq(patients.id, userId))
      .limit(1);
    if (!row) {
      throw new NotFoundException(
        'Patient profile not found — create one first',
      );
    }
    return row;
  }

  listFamilyMembers(patientId: string) {
    return this.db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.patientId, patientId));
  }

  async addFamilyMember(patientId: string, input: AddFamilyMemberInput) {
    const [row] = await this.db
      .insert(familyMembers)
      .values({ patientId, ...input })
      .returning();
    return row;
  }

  async updateFamilyMember(
    patientId: string,
    familyMemberId: string,
    input: UpdateFamilyMemberInput,
  ) {
    const [row] = await this.db
      .update(familyMembers)
      .set(input)
      .where(
        and(
          eq(familyMembers.id, familyMemberId),
          eq(familyMembers.patientId, patientId),
        ),
      )
      .returning();
    if (!row) {
      throw new NotFoundException('Family member not found');
    }
    return row;
  }

  async deleteFamilyMember(
    patientId: string,
    familyMemberId: string,
  ): Promise<void> {
    const [row] = await this.db
      .delete(familyMembers)
      .where(
        and(
          eq(familyMembers.id, familyMemberId),
          eq(familyMembers.patientId, patientId),
        ),
      )
      .returning({ id: familyMembers.id });
    if (!row) {
      throw new NotFoundException('Family member not found');
    }
  }

  /** Used by BookingModule to verify a family member belongs to the booking patient. */
  async assertFamilyMemberOwnedBy(
    patientId: string,
    familyMemberId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, familyMemberId),
          eq(familyMembers.patientId, patientId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Family member not found');
    }
  }
}
