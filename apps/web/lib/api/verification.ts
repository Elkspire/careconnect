import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface VerificationDocument {
  id: string;
  documentType: string;
  fileName: string;
  uploadedAt: string;
}

export async function listMyVerificationDocuments(): Promise<VerificationDocument[]> {
  const res = await authedFetch("/practitioners/me/verification-documents");
  return parseJsonOrThrow(res, "List verification documents");
}

export async function uploadVerificationDocument(
  formData: FormData,
): Promise<VerificationDocument> {
  const res = await authedFetch("/practitioners/me/verification-documents", {
    method: "POST",
    body: formData,
  });
  return parseJsonOrThrow(res, "Upload verification document");
}

export async function deleteVerificationDocument(id: string): Promise<void> {
  const res = await authedFetch(`/practitioners/me/verification-documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Delete verification document failed: ${res.status}`);
  }
}
