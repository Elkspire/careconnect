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

export type LoginRole = 'patient' | 'practitioner' | 'staff';

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
   * Lets the login page reject a role pick before sending an OTP, and say
   * which card the number actually belongs to. Each login card maps to one
   * kind of account:
   *   - 'patient'      → has a patients row
   *   - 'practitioner' → a doctor: a practitioners row, or active staff as
   *                      owner / junior_doctor
   *   - 'staff'        → active staff as receptionist
   * A brand-new number (or one with none of the above) may pick patient or
   * practitioner — onboarding takes it from there — but not staff:
   * receptionists can't sign themselves up, a clinic owner invites them.
   */
  async checkRoleEligibility(
    phone: string,
    role: LoginRole,
  ): Promise<{ ok: boolean; suggestedRole?: LoginRole }> {
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
        .select({ role: clinicStaff.role })
        .from(clinicStaff)
        .where(
          and(
            eq(clinicStaff.userId, authUser.id),
            eq(clinicStaff.status, 'active'),
          ),
        ),
    ]);

    const held: Record<LoginRole, boolean> = {
      patient: !!patient,
      practitioner:
        !!practitioner ||
        staffRows.some((s) => s.role === 'owner' || s.role === 'junior_doctor'),
      staff: staffRows.some((s) => s.role === 'receptionist'),
    };

    if (held[role]) {
      return { ok: true };
    }
    // An account that holds nothing yet is effectively brand new.
    if (
      role !== 'staff' &&
      !held.patient &&
      !held.practitioner &&
      !held.staff
    ) {
      return { ok: true };
    }
    const suggestedRole = (['practitioner', 'staff', 'patient'] as const).find(
      (r) => held[r],
    );
    return { ok: false, suggestedRole };
  }
}
