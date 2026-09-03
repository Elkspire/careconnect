import type {
  AvailabilityQuery,
  CancelAppointmentInput,
  CreateAppointmentInput,
  JoinWaitlistInput,
  RescheduleAppointmentInput,
} from "@careconnect/validation";
import { API_URL, authedFetch, parseJsonOrThrow } from "./client";

export interface DayAvailability {
  date: string;
  slots: { start: string; end: string }[];
}

export interface Appointment {
  id: string;
  patientId: string;
  subjectType: string;
  familyMemberId: string | null;
  practitionerId: string;
  clinicId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  cancellationReason: string | null;
}

export interface MyAppointment extends Appointment {
  practitionerFullName: string;
  practitionerSlug: string;
}

export interface WaitlistEntry {
  id: string;
  subjectType: string;
  familyMemberId: string | null;
  practitionerId: string;
  practitionerFullName: string;
  practitionerSlug: string;
  clinicId: string;
  clinicName: string;
  requestedDate: string;
  status: string;
  createdAt: string;
}

// Public — no auth required, so a patient can preview slots before signing in.
export async function getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
  const params = new URLSearchParams({
    practitionerId: query.practitionerId,
    clinicId: query.clinicId,
    fromDate: query.fromDate,
    toDate: query.toDate,
  });
  const res = await fetch(`${API_URL}/booking/availability?${params.toString()}`);
  return parseJsonOrThrow(res, "Get availability");
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const res = await authedFetch("/booking/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Create appointment");
}

export async function rescheduleAppointment(
  input: RescheduleAppointmentInput,
): Promise<Appointment> {
  const res = await authedFetch("/booking/appointments/reschedule", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Reschedule appointment");
}

export async function cancelAppointment(input: CancelAppointmentInput): Promise<Appointment> {
  const res = await authedFetch("/booking/appointments/cancel", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Cancel appointment");
}

export async function listMyAppointments(): Promise<MyAppointment[]> {
  const res = await authedFetch("/booking/appointments");
  return parseJsonOrThrow(res, "List appointments");
}

export async function joinWaitlist(input: JoinWaitlistInput): Promise<WaitlistEntry> {
  const res = await authedFetch("/booking/waitlist", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Join waitlist");
}

export async function listMyWaitlist(): Promise<WaitlistEntry[]> {
  const res = await authedFetch("/booking/waitlist");
  return parseJsonOrThrow(res, "List waitlist");
}

export async function leaveWaitlist(id: string): Promise<void> {
  const res = await authedFetch(`/booking/waitlist/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Leave waitlist failed: ${res.status}`);
  }
}
