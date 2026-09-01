import type { RejectPractitionerInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface AdminPractitioner {
  id: string;
  fullName: string;
  practitionerType: string;
  councilRegistrationNo: string;
  verificationStatus: string;
  verificationNote: string | null;
  verifiedAt: string | null;
  phone: string | null;
  createdAt: string;
}

/** Throws on a 403 (not an admin) — the page catches this and shows access-denied rather than crashing. */
export async function listPendingPractitioners(): Promise<AdminPractitioner[]> {
  const res = await authedFetch("/admin/practitioners");
  return parseJsonOrThrow(res, "List pending practitioners");
}

export async function verifyPractitioner(id: string): Promise<AdminPractitioner> {
  const res = await authedFetch(`/admin/practitioners/${id}/verify`, { method: "POST" });
  return parseJsonOrThrow(res, "Verify practitioner");
}

export async function rejectPractitioner(
  id: string,
  input: RejectPractitionerInput,
): Promise<AdminPractitioner> {
  const res = await authedFetch(`/admin/practitioners/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Reject practitioner");
}
