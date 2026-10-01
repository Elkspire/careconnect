import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  authUsers,
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

  /**
   * Lets the login page reject a role pick before sending an OTP, e.g. a
   * doctor selecting "I'm looking for a doctor" with their practice email.
   * A brand-new email (no CareConnect account yet) is always eligible for
   * either role — the role only matters once an account actually exists.
   * Clinic staff (receptionist etc., no practitioners row of their own)
   * count as the provider side, matching the login page's two cards.
   */
  async checkRoleEligibility(
    email: string,
    role: 'patient' | 'practitioner',
  ): Promise<{ ok: boolean }> {
    const [authUser] = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email.toLowerCase()))
      .limit(1);
    if (!authUser) {
      return { ok: true };
    }

    const [patient, practitioner, staffRows] = await Promise.all([
      this.db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, authUser.id))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(eq(practitioners.id, authUser.id))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select({ id: clinicStaff.id })
        .from(clinicStaff)
        .where(eq(clinicStaff.userId, authUser.id))
        .limit(1),
    ]);

    const hasPatient = !!patient;
    const isProvider = !!practitioner || staffRows.length > 0;
    if (!hasPatient && !isProvider) {
      return { ok: true };
    }
    return { ok: role === 'patient' ? hasPatient : isProvider };
  }
}
