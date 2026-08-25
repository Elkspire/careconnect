import type { AddFamilyMemberInput, UpdatePatientProfileInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface PatientProfile {
  id: string;
  fullName: string;
  gender: string | null;
  dob: string | null;
  preferredLanguage: string;
  email: string | null;
}

export interface FamilyMember {
  id: string;
  patientId: string;
  fullName: string;
  relationship: string;
  dob: string | null;
  gender: string | null;
}

export async function getMyProfile(): Promise<PatientProfile | null> {
  const res = await authedFetch("/patients/me");
  if (res.status === 404) {
    return null;
  }
  return parseJsonOrThrow(res, "Get patient profile");
}

export async function upsertMyProfile(input: UpdatePatientProfileInput): Promise<PatientProfile> {
  const res = await authedFetch("/patients/me", { method: "PUT", body: JSON.stringify(input) });
  return parseJsonOrThrow(res, "Update patient profile");
}

export async function listFamilyMembers(): Promise<FamilyMember[]> {
  const res = await authedFetch("/patients/me/family-members");
  return parseJsonOrThrow(res, "List family members");
}

export async function addFamilyMember(input: AddFamilyMemberInput): Promise<FamilyMember> {
  const res = await authedFetch("/patients/me/family-members", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Add family member");
}
