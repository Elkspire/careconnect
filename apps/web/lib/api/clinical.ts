import type {
  CreateClinicalNoteInput,
  PrescriptionItemInput,
  UpdateClinicalNoteInput,
} from "@careconnect/validation";
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

export interface PrescriptionItem {
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
}

export interface MyClinicalHistoryEntry {
  appointmentId: string;
  notes: string;
  diagnosis: string | null;
  createdAt: string;
  subjectType: string;
  familyMemberFullName: string | null;
  practitionerFullName: string;
  clinicName: string;
  scheduledStart: string;
  prescriptionItems: PrescriptionItem[];
}

/** A patient's own doctor-authored visit history, across every clinic they've visited. */
export async function listMyClinicalHistory(): Promise<MyClinicalHistoryEntry[]> {
  const res = await authedFetch("/patients/me/clinical-history");
  return parseJsonOrThrow(res, "List clinical history");
}

/** The patient's (or family member's) recorded allergies for this appointment, shown before writing a note/prescription. */
export async function getAppointmentAllergies(
  clinicId: string,
  appointmentId: string,
): Promise<string[]> {
  const res = await authedFetch(`/clinics/${clinicId}/clinical-notes/${appointmentId}/allergies`);
  return parseJsonOrThrow(res, "Get appointment allergies");
}

export async function getPrescription(
  clinicId: string,
  appointmentId: string,
): Promise<PrescriptionItem[]> {
  const res = await authedFetch(
    `/clinics/${clinicId}/clinical-notes/${appointmentId}/prescription`,
  );
  return parseJsonOrThrow(res, "Get prescription");
}

export async function savePrescription(
  clinicId: string,
  appointmentId: string,
  items: PrescriptionItemInput[],
): Promise<{ items: PrescriptionItem[]; allergyWarnings: string[] }> {
  const res = await authedFetch(
    `/clinics/${clinicId}/clinical-notes/${appointmentId}/prescription`,
    { method: "POST", body: JSON.stringify({ items }) },
  );
  return parseJsonOrThrow(res, "Save prescription");
}
