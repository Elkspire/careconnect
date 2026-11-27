"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { LOCALE_COOKIE, routing, type AppLocale } from "@/i18n/routing";
import { BLOOD_GROUP, type BloodGroup } from "@careconnect/shared-types";
import { orSavedUnrecorded, unlessRefused } from "@/lib/api/audit";
import { getTranslations } from "next-intl/server";
import type { FormResult } from "@/lib/form-result";
import { addFamilyMember, upsertMyProfile } from "@/lib/api/patients";
import {
  cancelAppointment,
  createAppointment,
  joinWaitlist,
  leaveWaitlist,
  rescheduleAppointment,
} from "@/lib/api/booking";
import { getVaultRecordSignedUrl, uploadVaultRecord } from "@/lib/api/vault";
import {
  upsertFamilyMemberMedicalSummary,
  upsertMyMedicalSummary,
} from "@/lib/api/medical-summary";
import { createShare, revokeShare } from "@/lib/api/shares";

/** One item per non-empty line — how the medical summary form's textareas encode a string list. */
function linesToList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

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

/**
 * Why the API turned a booking change down, as the code the page shows a
 * message for. Anything that isn't an ordinary refusal is thrown on, as
 * before. Returned rather than redirected to: redirect() works by throwing,
 * so it has to happen outside the caller's try.
 */
function bookingRefusal(err: unknown): "unavailable" | "window" {
  const status = err instanceof Error ? / failed: (\d{3}) /.exec(err.message)?.[1] : undefined;
  if (status === "409") return "unavailable";
  if (status === "403") return "window";
  throw err;
}

export async function saveProfileAction(locale: string, formData: FormData): Promise<void> {
  const requested = String(formData.get("preferredLanguage") ?? "");
  const preferredLanguage: AppLocale = hasLocale(routing.locales, requested) ? requested : locale as AppLocale;
  try {
    await upsertMyProfile({
      fullName: String(formData.get("fullName") ?? ""),
      preferredLanguage,
    });
  } catch (err) {
    // Left uncaught this replaced the whole page with a bare "Update
    // patient profile failed: 500". Logged for the server console; the
    // patient gets a message on the form instead.
    console.error(err);
    redirect("/patient?profileError=1");
  }
  revalidatePath(`/${locale}/patient`);
  // The saved language used to only reach notifications — the site stayed
  // in its old language. The site's language is next-intl's cookie, so set
  // that too and reload the page in the new language.
  if (preferredLanguage !== locale) {
    (await cookies()).set(LOCALE_COOKIE, preferredLanguage, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    redirect("/patient");
  }
}

export async function addFamilyMemberAction(locale: string, formData: FormData): Promise<FormResult> {
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
  return { status: "success", message: (await getTranslations("patient"))("familyMemberAdded") };
}

export async function createAppointmentAction(
  locale: string,
  practitionerSlug: string,
  clinicSlug: string,
  formData: FormData,
): Promise<void> {
  const familyMemberId = formData.get("familyMemberId");
  const practitionerId = String(formData.get("practitionerId"));
  const clinicId = String(formData.get("clinicId"));
  const scheduledStart = String(formData.get("scheduledStart"));

  let refusal: string | undefined;
  try {
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
  } catch (err) {
    refusal = bookingRefusal(err);
  }
  if (refusal) {
    // Back to the same day, which reloads what is still open.
    const query = new URLSearchParams({
      date: String(formData.get("requestedDate") ?? ""),
      error: refusal,
    });
    redirect(
      `/patient/book/${encodeURIComponent(practitionerSlug)}/${encodeURIComponent(clinicSlug)}?${query}`,
    );
  }

  revalidatePath(`/${locale}/patient/appointments`);
  redirect(`/patient/appointments`);
}

export async function rescheduleAppointmentAction(
  locale: string,
  formData: FormData,
): Promise<FormResult> {
  const t = await getTranslations("patient");
  try {
    await rescheduleAppointment({
      appointmentId: String(formData.get("appointmentId")),
      scheduledStart: toClinicIso(String(formData.get("scheduledStart"))),
    });
  } catch (err) {
    return { status: "error", message: t(`bookingError.${bookingRefusal(err)}`) };
  }
  revalidatePath(`/${locale}/patient/appointments`);
  return { status: "success", message: t("appointmentMoved") };
}

export async function cancelAppointmentAction(
  locale: string,
  formData: FormData,
): Promise<FormResult> {
  const t = await getTranslations("patient");
  try {
    await cancelAppointment({ appointmentId: String(formData.get("appointmentId")) });
  } catch (err) {
    // A 409 here is about the appointment (already cancelled, or over), not a time.
    const refusal = bookingRefusal(err) === "window" ? "window" : "changed";
    revalidatePath(`/${locale}/patient/appointments`);
    return { status: "error", message: t(`bookingError.${refusal}`) };
  }
  revalidatePath(`/${locale}/patient/appointments`);
  return { status: "success", message: t("appointmentCancelled") };
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
  redirect(`/patient/appointments`);
}

export async function leaveWaitlistAction(locale: string, formData: FormData): Promise<void> {
  await leaveWaitlist(String(formData.get("waitlistEntryId")));
  revalidatePath(`/${locale}/patient/appointments`);
}

/** Returns whether the upload could be recorded; it is saved either way. */
async function uploadRecord(locale: string, formData: FormData): Promise<{ recorded: boolean }> {
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
  const saved = await orSavedUnrecorded(uploadVaultRecord(formData));
  revalidatePath(`/${locale}/patient/vault`);
  return { recorded: saved !== null };
}

export async function uploadVaultRecordAction(
  locale: string,
  formData: FormData,
): Promise<FormResult> {
  const { recorded } = await uploadRecord(locale, formData);
  if (!recorded) {
    return { status: "warning", message: (await getTranslations("audit"))("saved.body") };
  }
  return { status: "success", message: (await getTranslations("vault"))("uploaded") };
}

/** For the scanner, which says what happened itself instead of leaving the page. */
export async function uploadScanAction(
  locale: string,
  formData: FormData,
): Promise<{ recorded: boolean }> {
  return uploadRecord(locale, formData);
}

export async function viewVaultRecordAction(_locale: string, formData: FormData): Promise<void> {
  const link = await unlessRefused(getVaultRecordSignedUrl(String(formData.get("recordId"))));
  redirect(link?.url ?? "/patient/vault?audit=refused");
}

export async function upsertMedicalSummaryAction(
  locale: string,
  formData: FormData,
): Promise<FormResult> {
  const bloodGroupRaw = String(formData.get("bloodGroup") ?? "");
  const bloodGroup = BLOOD_GROUP.includes(bloodGroupRaw as BloodGroup)
    ? (bloodGroupRaw as BloodGroup)
    : undefined;
  const input = {
    bloodGroup,
    allergies: linesToList(formData.get("allergies")),
    chronicConditions: linesToList(formData.get("chronicConditions")),
    activeMedications: linesToList(formData.get("activeMedications")),
  };

  const familyMemberId = formData.get("familyMemberId");
  if (familyMemberId) {
    await upsertFamilyMemberMedicalSummary(String(familyMemberId), input);
  } else {
    await upsertMyMedicalSummary(input);
  }
  revalidatePath(`/${locale}/patient/vault`);
  return { status: "success", message: (await getTranslations("vault"))("summarySaved") };
}

export async function createShareAction(locale: string, formData: FormData): Promise<FormResult> {
  const familyMemberId = formData.get("familyMemberId");
  await createShare({
    subjectType: familyMemberId ? "family_member" : "self",
    familyMemberId: familyMemberId ? String(familyMemberId) : undefined,
    includeClinicalHistory: formData.get("includeClinicalHistory") === "on",
    includeLabReports: formData.get("includeLabReports") === "on",
    includeOtherRecords: formData.get("includeOtherRecords") === "on",
    duration: (formData.get("duration") as "24h" | "7d" | "forever") ?? "7d",
  });
  revalidatePath(`/${locale}/patient/vault`);
  return { status: "success", message: (await getTranslations("vault"))("shareCreated") };
}

export async function revokeShareAction(locale: string, formData: FormData): Promise<void> {
  await revokeShare(String(formData.get("shareId")));
  revalidatePath(`/${locale}/patient/vault`);
}
