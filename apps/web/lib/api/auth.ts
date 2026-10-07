import { API_URL } from "./config";

/**
 * Checked from the login page before sending an OTP, so a doctor entering
 * their practice email under the "patient" card (or vice versa) gets told
 * immediately instead of discovering it only after post-login redirects
 * them to their real dashboard. A brand-new email is always eligible.
 */
export async function checkRoleEligibility(
  email: string,
  role: "patient" | "practitioner" | "staff",
): Promise<boolean> {
  const params = new URLSearchParams({ email, role });
  const res = await fetch(`${API_URL}/auth/check-role?${params.toString()}`);
  if (!res.ok) {
    // Fail open — a transient API error shouldn't block login itself, only
    // the extra role-mismatch hint.
    return true;
  }
  const data: { ok: boolean } = await res.json();
  return data.ok;
}
