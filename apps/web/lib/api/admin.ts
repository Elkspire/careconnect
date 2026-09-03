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

export interface ReportedReview {
  reportId: string;
  reviewId: string;
  reason: string;
  reportedAt: string;
  rating: number;
  comment: string | null;
  practitionerId: string;
  practitionerFullName: string;
}

/** Throws on a 403 (not an admin) — same pattern as listPendingPractitioners. */
export async function listReportedReviews(): Promise<ReportedReview[]> {
  const res = await authedFetch("/admin/reviews/reported");
  return parseJsonOrThrow(res, "List reported reviews");
}

export async function hideReview(reviewId: string): Promise<void> {
  const res = await authedFetch(`/admin/reviews/${reviewId}/hide`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Hide review failed: ${res.status}`);
  }
}

export interface HiddenReview {
  id: string;
  rating: number;
  comment: string | null;
  practitionerId: string;
  practitionerFullName: string;
}

export async function listHiddenReviews(): Promise<HiddenReview[]> {
  const res = await authedFetch("/admin/reviews/hidden");
  return parseJsonOrThrow(res, "List hidden reviews");
}

export async function unhideReview(reviewId: string): Promise<void> {
  const res = await authedFetch(`/admin/reviews/${reviewId}/unhide`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Unhide review failed: ${res.status}`);
  }
}

export interface AdminVerificationDocument {
  id: string;
  documentType: string;
  fileName: string;
  uploadedAt: string;
}

export async function listPractitionerDocuments(
  practitionerId: string,
): Promise<AdminVerificationDocument[]> {
  const res = await authedFetch(`/admin/practitioners/${practitionerId}/verification-documents`);
  return parseJsonOrThrow(res, "List practitioner verification documents");
}

export async function getDocumentSignedUrl(documentId: string): Promise<{ url: string }> {
  const res = await authedFetch(`/admin/verification-documents/${documentId}/signed-url`);
  return parseJsonOrThrow(res, "Get verification document link");
}
