import { apiFetch } from "./config";

/**
 * Checked from the login page before sending an OTP, so a doctor entering
 * their practice number under the "patient" card (or vice versa) gets told
 * immediately instead of discovering it only after post-login redirects
 * them to their real dashboard. A brand-new number is eligible for every
 * role except staff, who must be invited first.
 */
export type LoginRole = "patient" | "practitioner" | "staff";

export interface RoleEligibility {
  ok: boolean;
  /** When ok is false: the card this number actually belongs to, if any. */
  suggestedRole?: LoginRole;
}

export async function checkRoleEligibility(
  phone: string,
  role: LoginRole,
): Promise<RoleEligibility> {
  const params = new URLSearchParams({ phone, role });
  const res = await apiFetch(`/auth/check-role?${params.toString()}`);
  if (!res.ok) {
    // Fail open — a transient API error shouldn't block login itself, only
    // the extra role-mismatch hint. post-login still routes by real role.
    return { ok: true };
  }
  return (await res.json()) as RoleEligibility;
}
