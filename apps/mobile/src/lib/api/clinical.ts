import { authedFetch, parseJsonOrThrow } from "./client";

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
