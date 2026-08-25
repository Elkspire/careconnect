import type { CreateClinicalNoteInput, UpdateClinicalNoteInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface ClinicalNote {
  id: string;
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  notes: string;
  diagnosis: string | null;
}

export async function getClinicalNote(
  clinicId: string,
  appointmentId: string,
): Promise<ClinicalNote | null> {
  const res = await authedFetch(`/clinics/${clinicId}/clinical-notes/${appointmentId}`);
  if (res.status === 404) {
    return null;
  }
  return parseJsonOrThrow(res, "Get clinical note");
}

export async function createClinicalNote(
  clinicId: string,
  input: CreateClinicalNoteInput,
): Promise<ClinicalNote> {
  const res = await authedFetch(`/clinics/${clinicId}/clinical-notes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Create clinical note");
}

export async function updateClinicalNote(
  clinicId: string,
  appointmentId: string,
  input: UpdateClinicalNoteInput,
): Promise<ClinicalNote> {
  const res = await authedFetch(`/clinics/${clinicId}/clinical-notes/${appointmentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Update clinical note");
}
