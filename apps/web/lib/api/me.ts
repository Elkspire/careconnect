import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface MeResponse {
  id: string;
  phone?: string;
  email?: string;
  patient: { id: string; fullName: string; preferredLanguage: string } | null;
  practitioner: { id: string; fullName: string; verificationStatus: string } | null;
  clinicStaff: Array<{
    clinicId: string;
    clinicSlug: string;
    clinicName: string;
    role: string;
    status: string;
  }>;
}

export async function getMe(): Promise<MeResponse> {
  const res = await authedFetch("/me");
  return parseJsonOrThrow(res, "Get current user");
}

/**
 * Clinic dashboard routes are keyed by slug in the URL (see the [clinicSlug]
 * route folder), but every clinic-staff API endpoint still keys on the real
 * clinic UUID — each clinic page resolves the slug back to a real
 * clinicId/role via this before making any other API call, the same
 * slug-then-resolve pattern the public practitioner/booking pages use.
 */
export async function resolveClinicStaffBySlug(
  clinicSlug: string,
): Promise<MeResponse["clinicStaff"][number] | null> {
  const me = await getMe();
  return (
    me.clinicStaff.find((s) => s.clinicSlug === clinicSlug && s.status === "active") ?? null
  );
}
