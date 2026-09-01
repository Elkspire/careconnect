import type { CreateShareInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";
import { API_URL } from "./config";

export interface RecordShare {
  id: string;
  subjectType: string;
  familyMemberId: string | null;
  familyMemberFullName: string | null;
  token: string;
  includeClinicalHistory: boolean;
  includeLabReports: boolean;
  includeOtherRecords: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  accessCount: number;
}

export interface SharedPrescriptionItem {
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
}

export interface SharedVisit {
  appointmentId: string;
  notes: string;
  diagnosis: string | null;
  createdAt: string;
  subjectType: string;
  familyMemberFullName: string | null;
  practitionerFullName: string;
  clinicName: string;
  scheduledStart: string;
  prescriptionItems: SharedPrescriptionItem[];
}

export interface SharedRecord {
  id: string;
  recordType: string;
  fileName: string;
  createdAt: string;
  url: string | null;
}

export interface SharedBundle {
  subjectFullName: string | null;
  scope: {
    includeClinicalHistory: boolean;
    includeLabReports: boolean;
    includeOtherRecords: boolean;
  };
  expiresAt: string | null;
  medicalSummary: {
    bloodGroup: string | null;
    allergies: string[];
    chronicConditions: string[];
    activeMedications: string[];
  } | null;
  clinicalHistory: SharedVisit[];
  records: SharedRecord[];
}

export async function listMyShares(): Promise<RecordShare[]> {
  const res = await authedFetch("/shares");
  return parseJsonOrThrow(res, "List shares");
}

export async function createShare(input: CreateShareInput): Promise<RecordShare> {
  const res = await authedFetch("/shares", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Create share");
}

export async function revokeShare(shareId: string): Promise<void> {
  const res = await authedFetch(`/shares/${shareId}/revoke`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Revoke share failed: ${res.status}`);
  }
}

/** No session involved — this is the link a doctor opens without a CareConnect account. */
export async function getSharedBundle(token: string): Promise<SharedBundle | null> {
  const res = await fetch(`${API_URL}/shares/view/${token}`, { cache: "no-store" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Get shared record failed: ${res.status}`);
  }
  return res.json();
}
