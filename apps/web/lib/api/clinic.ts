import type { InviteReceptionistInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";

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
  fullName: string;
  phone: string | null;
  lastVisit: string;
}

export interface ClinicStaffMember {
  id: string;
  clinicId: string;
  userId: string;
  role: string;
  status: string;
}

export async function listMyClinics(): Promise<Clinic[]> {
  const res = await authedFetch("/clinics/mine");
  return parseJsonOrThrow(res, "List my clinics");
}

export async function listToday(clinicId: string): Promise<TodayAppointment[]> {
  const res = await authedFetch(`/clinics/${clinicId}/today`);
  return parseJsonOrThrow(res, "List today's appointments");
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

export async function listStaff(clinicId: string): Promise<ClinicStaffMember[]> {
  const res = await authedFetch(`/clinics/${clinicId}/staff`);
  return parseJsonOrThrow(res, "List clinic staff");
}

export async function inviteStaff(
  clinicId: string,
  input: InviteReceptionistInput,
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
