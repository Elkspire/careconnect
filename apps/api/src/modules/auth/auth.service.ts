import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
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
   * doctor selecting "I'm looking for a doctor" with their practice phone.
   * A brand-new number (no CareConnect account yet) is always eligible for
   * either role — the role only matters once an account actually exists.
   * Clinic staff (receptionist etc., no practitioners row of their own)
   * also count as the provider side for the practitioner card.
   *
   * 'staff' is the exception to "brand-new is always eligible": staff
   * can't sign themselves up — a clinic owner has to invite them first —
   * so with no active clinic_staff row there's nowhere for them to land.
   * Without this check they fell through post-login as a brand-new
   * account and ended up as a patient.
   */
  async checkRoleEligibility(
    phone: string,
    role: 'patient' | 'practitioner' | 'staff',
  ): Promise<{ ok: boolean }> {
    // phoneSchema guarantees E.164 with a leading '+'; Supabase Auth stores
    // auth.users.phone without it.
    const [authUser] = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.phone, phone.replace(/^\+/, '')))
      .limit(1);
    if (!authUser) {
      return { ok: role !== 'staff' };
    }

    if (role === 'staff') {
      const [activeStaff] = await this.db
        .select({ id: clinicStaff.id })
        .from(clinicStaff)
        .where(
          and(
            eq(clinicStaff.userId, authUser.id),
            eq(clinicStaff.status, 'active'),
          ),
        )
        .limit(1);
      return { ok: !!activeStaff };
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
