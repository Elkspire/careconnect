import { API_URL } from "./config";

/**
 * Checked from the login page before sending an OTP, so a doctor entering
 * their practice number under the "patient" card (or vice versa) gets told
 * immediately instead of discovering it only after post-login redirects
 * them to their real dashboard. A brand-new number is eligible for every
 * role except staff, who must be invited first.
 */
export async function checkRoleEligibility(
  phone: string,
  role: "patient" | "practitioner" | "staff",
): Promise<boolean> {
  const params = new URLSearchParams({ phone, role });
  const res = await fetch(`${API_URL}/auth/check-role?${params.toString()}`);
  if (!res.ok) {
    // Fail open — a transient API error shouldn't block login itself, only
    // the extra role-mismatch hint.
    return true;
  }
  const data: { ok: boolean } = await res.json();
  return data.ok;
}
