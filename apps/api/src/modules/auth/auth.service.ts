import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  clinicStaff,
  clinics,
  patients,
  practitioners,
} from '../../common/database/schema';

export interface MeResponse {
  id: string;
  phone?: string;
  email?: string;
  patient: { id: string; fullName: string; preferredLanguage: string } | null;
  practitioner: {
    id: string;
    fullName: string;
    verificationStatus: string;
  } | null;
  clinicStaff: Array<{
    clinicId: string;
    clinicSlug: string;
    clinicName: string;
    role: string;
    status: string;
  }>;
}

@Injectable()
export class AuthService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getMe(
    userId: string,
  ): Promise<Omit<MeResponse, 'id' | 'phone' | 'email'>> {
    const [patient, practitioner, staffRows] = await Promise.all([
      this.db
        .select({
          id: patients.id,
          fullName: patients.fullName,
          preferredLanguage: patients.preferredLanguage,
        })
        .from(patients)
        .where(eq(patients.id, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select({
          id: practitioners.id,
          fullName: practitioners.fullName,
          verificationStatus: practitioners.verificationStatus,
        })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select({
          clinicId: clinicStaff.clinicId,
          clinicSlug: clinics.slug,
          clinicName: clinics.name,
          role: clinicStaff.role,
          status: clinicStaff.status,
        })
        .from(clinicStaff)
        .innerJoin(clinics, eq(clinics.id, clinicStaff.clinicId))
        .where(eq(clinicStaff.userId, userId)),
    ]);

    return { patient, practitioner, clinicStaff: staffRows };
  }
}
