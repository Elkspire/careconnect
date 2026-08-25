import type {
  AvailabilityQuery,
  CancelAppointmentInput,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";
import { API_URL } from "./config";

export interface DayAvailability {
  date: string;
  slots: Array<{ start: string; end: string }>;
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

// Public — no auth required, so a patient can preview slots before signing in.
export async function getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
  const params = new URLSearchParams({
    practitionerId: query.practitionerId,
    clinicId: query.clinicId,
    fromDate: query.fromDate,
    toDate: query.toDate,
  });
  const res = await fetch(`${API_URL}/booking/availability?${params.toString()}`, {
    cache: "no-store",
  });
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
