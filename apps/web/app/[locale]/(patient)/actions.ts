"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addFamilyMember, upsertMyProfile } from "@/lib/api/patients";
import {
  cancelAppointment,
  createAppointment,
  joinWaitlist,
  leaveWaitlist,
  rescheduleAppointment,
} from "@/lib/api/booking";
import { getVaultRecordSignedUrl, uploadVaultRecord } from "@/lib/api/vault";

// Matches apps/api/src/modules/booking/availability.ts's CLINIC_UTC_OFFSET —
// v1 is Pakistan-only, so every appointment time is reasoned about in PKT.
const CLINIC_UTC_OFFSET = "+05:00";

/**
 * <input type="datetime-local"> yields a bare "YYYY-MM-DDTHH:mm" — no
 * seconds, no timezone. The API's scheduledStart validation
 * (z.string().datetime() in packages/validation) requires a strict
 * "Z"-suffixed UTC ISO string, the same shape the slot-picker buttons
 * already send; the reschedule form was passing the raw input straight
 * through unconverted, which is what a 400 "Invalid datetime" means.
 * Interpreted as the clinic's own PKT time, not the browser's or server's
 * local timezone, since neither of those is necessarily correct.
 */
function toClinicIso(datetimeLocal: string): string {
  return new Date(`${datetimeLocal}:00${CLINIC_UTC_OFFSET}`).toISOString();
}

export async function saveProfileAction(locale: string, formData: FormData): Promise<void> {
  await upsertMyProfile({
    fullName: String(formData.get("fullName") ?? ""),
    preferredLanguage: (formData.get("preferredLanguage") as "en" | "ur") ?? "en",
  });
  revalidatePath(`/${locale}/patient`);
}

export async function addFamilyMemberAction(locale: string, formData: FormData): Promise<void> {
  await addFamilyMember({
    fullName: String(formData.get("fullName") ?? ""),
    relationship: formData.get("relationship") as
      | "husband"
      | "wife"
      | "son"
      | "daughter"
      | "mother"
      | "father",
  });
  revalidatePath(`/${locale}/patient/family`);
}

export async function createAppointmentAction(
  locale: string,
  formData: FormData,
): Promise<void> {
  const familyMemberId = formData.get("familyMemberId");
  const practitionerId = String(formData.get("practitionerId"));
  const clinicId = String(formData.get("clinicId"));
  const scheduledStart = String(formData.get("scheduledStart"));

  if (familyMemberId) {
    await createAppointment({
      subjectType: "family_member",
      familyMemberId: String(familyMemberId),
      practitionerId,
      clinicId,
      scheduledStart,
    });
  } else {
    await createAppointment({ subjectType: "self", practitionerId, clinicId, scheduledStart });
  }

  revalidatePath(`/${locale}/patient/appointments`);
  redirect(`/${locale}/patient/appointments`);
}

export async function rescheduleAppointmentAction(
  locale: string,
  formData: FormData,
): Promise<void> {
  await rescheduleAppointment({
    appointmentId: String(formData.get("appointmentId")),
    scheduledStart: toClinicIso(String(formData.get("scheduledStart"))),
  });
  revalidatePath(`/${locale}/patient/appointments`);
}

export async function cancelAppointmentAction(locale: string, formData: FormData): Promise<void> {
  await cancelAppointment({ appointmentId: String(formData.get("appointmentId")) });
  revalidatePath(`/${locale}/patient/appointments`);
}

export async function joinWaitlistAction(locale: string, formData: FormData): Promise<void> {
  const familyMemberId = formData.get("familyMemberId");
  const practitionerId = String(formData.get("practitionerId"));
  const clinicId = String(formData.get("clinicId"));
  const requestedDate = String(formData.get("requestedDate"));

  if (familyMemberId) {
    await joinWaitlist({
      subjectType: "family_member",
      familyMemberId: String(familyMemberId),
      practitionerId,
      clinicId,
      requestedDate,
    });
  } else {
    await joinWaitlist({ subjectType: "self", practitionerId, clinicId, requestedDate });
  }

  revalidatePath(`/${locale}/patient/appointments`);
  redirect(`/${locale}/patient/appointments`);
}

export async function leaveWaitlistAction(locale: string, formData: FormData): Promise<void> {
  await leaveWaitlist(String(formData.get("waitlistEntryId")));
  revalidatePath(`/${locale}/patient/appointments`);
}

export async function uploadVaultRecordAction(locale: string, formData: FormData): Promise<void> {
  // The form only sends familyMemberId (empty = self); derive subjectType
  // here rather than a hidden field, same pattern as createAppointmentAction
  // above. An empty familyMemberId would otherwise be sent as "" and fail
  // the API's z.string().uuid().optional() validation.
  const familyMemberId = formData.get("familyMemberId");
  if (familyMemberId) {
    formData.set("subjectType", "family_member");
  } else {
    formData.set("subjectType", "self");
    formData.delete("familyMemberId");
  }
  await uploadVaultRecord(formData);
  revalidatePath(`/${locale}/patient/vault`);
}

export async function viewVaultRecordAction(_locale: string, formData: FormData): Promise<void> {
  const { url } = await getVaultRecordSignedUrl(String(formData.get("recordId")));
  redirect(url);
}
