import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface VaultRecord {
  id: string;
  patientId: string;
  subjectType: string;
  familyMemberId: string | null;
  recordType: string;
  source: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export async function listVaultRecords(): Promise<VaultRecord[]> {
  const res = await authedFetch("/vault/records");
  return parseJsonOrThrow(res, "List vault records");
}

export async function uploadVaultRecord(formData: FormData): Promise<VaultRecord> {
  const res = await authedFetch("/vault/records", { method: "POST", body: formData });
  return parseJsonOrThrow(res, "Upload vault record");
}

export async function getVaultRecordSignedUrl(id: string): Promise<{ url: string }> {
  const res = await authedFetch(`/vault/records/${id}/signed-url`);
  return parseJsonOrThrow(res, "Get vault record link");
}

export async function deleteVaultRecord(id: string): Promise<void> {
  const res = await authedFetch(`/vault/records/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Delete vault record failed: ${res.status}`);
  }
}
