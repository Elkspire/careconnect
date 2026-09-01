import type { InviteStaffInput, UpsertMedicalSummaryInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";
import type { MedicalSummary } from "./medical-summary";

export interface Clinic {
  id: string;
  ownerPractitionerId: string;
  name: string;
  city: string;
  area: string;
  address: string;
  phone: string | null;
}

export interface TodayAppointment {
  appointmentId: string;
  scheduledStart: string;
  status: string;
  patientId: string;
  patientFullName: string;
  patientPhone: string | null;
}

export interface ClinicPatient {
  patientId: string;
  familyMemberId: string | null;
  fullName: string;
  guardianFullName: string | null;
  phone: string | null;
  lastVisit: string;
}

export interface ClinicWaitlistEntry {
  id: string;
  practitionerId: string;
  practitionerFullName: string;
  patientId: string;
  patientFullName: string;
  patientPhone: string | null;
  subjectType: string;
  familyMemberFullName: string | null;
  requestedDate: string;
  status: string;
  createdAt: string;
}

export interface ClinicStaffMember {
  id: string;
  clinicId: string;
  userId: string;
  role: string;
  status: string;
  revokedPermissions: string[];
}

export interface ClinicAppointmentSummary {
  appointmentId: string;
  scheduledStart: string;
  status: string;
}

export interface ClinicFamilyMemberSummary {
  familyMemberId: string;
  fullName: string;
  lastVisit: string;
}

export interface ClinicPatientDetail {
  patient: {
    patientId: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    dob: string | null;
  };
  appointments: ClinicAppointmentSummary[];
  familyMembers: ClinicFamilyMemberSummary[];
}

export interface ClinicFamilyMemberDetail {
  familyMember: {
    familyMemberId: string;
    fullName: string;
    relationship: string;
    gender: string | null;
    dob: string | null;
    guardianPatientId: string;
    guardianFullName: string;
    guardianPhone: string | null;
  };
  appointments: ClinicAppointmentSummary[];
}

export interface ClinicRecord {
  id: string;
  fileName: string;
  recordType: string;
  mimeType: string;
  linkedAppointmentId: string | null;
  createdAt: string;
}

export async function listMyClinics(): Promise<Clinic[]> {
  const res = await authedFetch("/clinics/mine");
  return parseJsonOrThrow(res, "List my clinics");
}

export async function listToday(clinicId: string): Promise<TodayAppointment[]> {
  const res = await authedFetch(`/clinics/${clinicId}/today`);
  return parseJsonOrThrow(res, "List today's appointments");
}

export async function listClinicWaitlist(clinicId: string): Promise<ClinicWaitlistEntry[]> {
  const res = await authedFetch(`/clinics/${clinicId}/waitlist`);
  return parseJsonOrThrow(res, "List clinic waitlist");
}

export async function checkIn(clinicId: string, appointmentId: string): Promise<void> {
  const res = await authedFetch(`/clinics/${clinicId}/check-in`, {
    method: "POST",
    body: JSON.stringify({ appointmentId }),
  });
  await parseJsonOrThrow(res, "Check in patient");
}

export async function listClinicPatients(clinicId: string): Promise<ClinicPatient[]> {
  const res = await authedFetch(`/clinics/${clinicId}/patients`);
  return parseJsonOrThrow(res, "List clinic patients");
}

export async function getClinicPatientDetail(
  clinicId: string,
  patientId: string,
): Promise<ClinicPatientDetail> {
  const res = await authedFetch(`/clinics/${clinicId}/patients/${patientId}`);
  return parseJsonOrThrow(res, "Get clinic patient detail");
}

export async function getClinicFamilyMemberDetail(
  clinicId: string,
  patientId: string,
  familyMemberId: string,
): Promise<ClinicFamilyMemberDetail> {
  const res = await authedFetch(
    `/clinics/${clinicId}/patients/${patientId}/family/${familyMemberId}`,
  );
  return parseJsonOrThrow(res, "Get clinic family member detail");
}

export async function listPatientRecords(
  clinicId: string,
  patientId: string,
): Promise<ClinicRecord[]> {
  const res = await authedFetch(`/clinics/${clinicId}/patients/${patientId}/records`);
  return parseJsonOrThrow(res, "List patient records");
}

export async function listFamilyMemberRecords(
  clinicId: string,
  patientId: string,
  familyMemberId: string,
): Promise<ClinicRecord[]> {
  const res = await authedFetch(
    `/clinics/${clinicId}/patients/${patientId}/family/${familyMemberId}/records`,
  );
  return parseJsonOrThrow(res, "List family member records");
}

export async function getClinicRecordSignedUrl(
  clinicId: string,
  recordId: string,
): Promise<{ url: string }> {
  const res = await authedFetch(`/clinics/${clinicId}/records/${recordId}/signed-url`);
  return parseJsonOrThrow(res, "Get clinic record link");
}

export async function getPatientMedicalSummary(
  clinicId: string,
  patientId: string,
): Promise<MedicalSummary | null> {
  const res = await authedFetch(`/clinics/${clinicId}/patients/${patientId}/medical-summary`);
  return parseJsonOrThrow(res, "Get patient medical summary");
}

export async function upsertPatientMedicalSummary(
  clinicId: string,
  patientId: string,
  input: UpsertMedicalSummaryInput,
): Promise<MedicalSummary> {
  const res = await authedFetch(`/clinics/${clinicId}/patients/${patientId}/medical-summary`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Update patient medical summary");
}

export async function getFamilyMemberMedicalSummary(
  clinicId: string,
  patientId: string,
  familyMemberId: string,
): Promise<MedicalSummary | null> {
  const res = await authedFetch(
    `/clinics/${clinicId}/patients/${patientId}/family/${familyMemberId}/medical-summary`,
  );
  return parseJsonOrThrow(res, "Get family member medical summary");
}

export async function upsertFamilyMemberMedicalSummary(
  clinicId: string,
  patientId: string,
  familyMemberId: string,
  input: UpsertMedicalSummaryInput,
): Promise<MedicalSummary> {
  const res = await authedFetch(
    `/clinics/${clinicId}/patients/${patientId}/family/${familyMemberId}/medical-summary`,
    { method: "PUT", body: JSON.stringify(input) },
  );
  return parseJsonOrThrow(res, "Update family member medical summary");
}

export async function listStaff(clinicId: string): Promise<ClinicStaffMember[]> {
  const res = await authedFetch(`/clinics/${clinicId}/staff`);
  return parseJsonOrThrow(res, "List clinic staff");
}

export async function inviteStaff(
  clinicId: string,
  input: InviteStaffInput,
): Promise<ClinicStaffMember> {
  const res = await authedFetch(`/clinics/${clinicId}/staff`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Invite staff");
}

export async function revokeStaff(clinicId: string, staffId: string): Promise<void> {
  const res = await authedFetch(`/clinics/${clinicId}/staff/${staffId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Revoke staff failed: ${res.status}`);
  }
}
