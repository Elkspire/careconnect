import type { UpsertMedicalSummaryInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface MedicalSummary {
  id: string;
  patientId: string;
  subjectType: string;
  familyMemberId: string | null;
  bloodGroup: string | null;
  allergies: string[];
  chronicConditions: string[];
  activeMedications: string[];
  updatedBy: string;
  updatedAt: string;
}

export async function getMyMedicalSummary(): Promise<MedicalSummary | null> {
  const res = await authedFetch("/patients/me/medical-summary");
  return parseJsonOrThrow(res, "Get medical summary");
}

export async function upsertMyMedicalSummary(
  input: UpsertMedicalSummaryInput,
): Promise<MedicalSummary> {
  const res = await authedFetch("/patients/me/medical-summary", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Update medical summary");
}

export async function getFamilyMemberMedicalSummary(
  familyMemberId: string,
): Promise<MedicalSummary | null> {
  const res = await authedFetch(`/patients/me/family-members/${familyMemberId}/medical-summary`);
  return parseJsonOrThrow(res, "Get family member medical summary");
}

export async function upsertFamilyMemberMedicalSummary(
  familyMemberId: string,
  input: UpsertMedicalSummaryInput,
): Promise<MedicalSummary> {
  const res = await authedFetch(`/patients/me/family-members/${familyMemberId}/medical-summary`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Update family member medical summary");
}
