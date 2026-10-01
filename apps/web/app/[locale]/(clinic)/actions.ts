"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BLOOD_GROUP,
  STAFF_PERMISSION_KEY,
  type AssignableStaffRole,
  type BloodGroup,
  type StaffPermissionKey,
} from "@careconnect/shared-types";
import {
  assignPatient,
  attachRecord,
  checkIn,
  getClinicRecordSignedUrl,
  inviteStaff,
  recordVitals,
  revokeStaff,
  unassignPatient,
  upsertFamilyMemberMedicalSummary,
  upsertPatientMedicalSummary,
} from "@/lib/api/clinic";
import {
  createClinicalNote,
  savePrescription,
  updateClinicalNote,
} from "@/lib/api/clinical";
import { reportReview } from "@/lib/api/reviews";
import { deleteVerificationDocument, uploadVerificationDocument } from "@/lib/api/verification";

/** One item per non-empty line — how the medical summary form's textareas encode a string list. */
function linesToList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function checkInAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  await checkIn(clinicId, String(formData.get("appointmentId")));
  revalidatePath(`/${locale}/clinic/${clinicSlug}/today`);
}

/** Empty string -> field omitted, not sent as 0 — recordVitalsSchema treats each measurement as optional. */
function optionalNumber(raw: FormDataEntryValue | null): number | undefined {
  const str = String(raw ?? "").trim();
  if (!str) return undefined;
  const n = Number(str);
  return Number.isFinite(n) ? n : undefined;
}

export async function recordVitalsAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  const appointmentId = String(formData.get("appointmentId"));
  await recordVitals(clinicId, appointmentId, {
    systolicMmhg: optionalNumber(formData.get("systolicMmhg")),
    diastolicMmhg: optionalNumber(formData.get("diastolicMmhg")),
    pulseBpm: optionalNumber(formData.get("pulseBpm")),
    weightKg: optionalNumber(formData.get("weightKg")),
    temperatureF: optionalNumber(formData.get("temperatureF")),
  });
  revalidatePath(`/${locale}/clinic/${clinicSlug}/today`);
}

export async function attachRecordAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  await attachRecord(clinicId, formData);
  revalidatePath(`/${locale}/clinic/${clinicSlug}/today`);
}

export async function reportReviewAction(
  locale: string,
  clinicSlug: string,
  practitionerId: string,
  formData: FormData,
): Promise<void> {
  await reportReview(practitionerId, String(formData.get("reviewId")), {
    reason: String(formData.get("reason") ?? ""),
  });
  revalidatePath(`/${locale}/clinic/${clinicSlug}/reviews`);
}

export async function inviteStaffAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  const roleRaw = formData.get("role");
  const role: AssignableStaffRole = roleRaw === "junior_doctor" ? roleRaw : "receptionist";
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const staffPath = `/${locale}/clinic/${clinicSlug}/staff`;

  try {
    await inviteStaff(clinicId, {
      clinicId,
      phone: phone || undefined,
      email: email || undefined,
      fullName: String(formData.get("fullName") ?? ""),
      role,
      deniedPermissions: formData
        .getAll("deniedPermissions")
        .map(String)
        .filter((v): v is StaffPermissionKey => (STAFF_PERMISSION_KEY as readonly string[]).includes(v)),
    });
  } catch (err) {
    // inviteStaff throws a plain Error whose message embeds the API's raw
    // JSON body (see parseJsonOrThrow) — e.g. "Invite staff failed: 404
    // {"message":"No CareConnect account found...",...}". Left uncaught,
    // this crashed the whole page with a generic error screen instead of
    // showing the invitee-facing reason (wrong phone/email, not signed up
    // yet, no practitioner profile for a junior doctor) next to the form.
    redirect(`${staffPath}?inviteError=${encodeURIComponent(extractApiErrorMessage(err))}`);
  }
  // A plain revalidatePath (no redirect) left a successful invite re-render
  // at whatever URL the form was submitted from — if that still carried an
  // ?inviteError= from a prior failed attempt, the error alert kept showing
  // even though this submission succeeded. Redirecting to a clean "?invited"
  // URL both clears that stale error and shows an explicit success alert.
  revalidatePath(staffPath);
  redirect(`${staffPath}?invited=1`);
}

function extractApiErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Something went wrong. Please try again.";
  }
  const jsonStart = err.message.indexOf("{");
  if (jsonStart === -1) {
    return err.message;
  }
  try {
    const parsed: unknown = JSON.parse(err.message.slice(jsonStart));
    if (parsed && typeof parsed === "object") {
      // nestjs-zod's validation exception puts the actual per-field reason
      // in `errors` (a zod issue list) and leaves the top-level `message`
      // as a generic "Validation failed" — that generic string is useless
      // shown on its own, so prefer the real issue text when present.
      if ("errors" in parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        const issues = parsed.errors
          .map((issue: unknown) =>
            issue && typeof issue === "object" && "message" in issue
              ? String((issue as { message: unknown }).message)
              : null,
          )
          .filter((m: string | null): m is string => !!m);
        if (issues.length > 0) return issues.join(" ");
      }
      if ("message" in parsed) {
        const { message } = parsed as { message: unknown };
        if (typeof message === "string") return message;
        if (Array.isArray(message)) return message.join(", ");
      }
    }
  } catch {
    // Not JSON — fall through to the raw message below.
  }
  return err.message;
}

export async function revokeStaffAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  await revokeStaff(clinicId, String(formData.get("staffId")));
  revalidatePath(`/${locale}/clinic/${clinicSlug}/staff`);
}

export async function assignPatientAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  // The subject select encodes "patientId:familyMemberId" (family half
  // empty for the patient themself) — one <select> can only post one
  // value, and this form has no client JS to pair a second field to it.
  const [patientId, familyMemberId] = String(formData.get("subject") ?? "").split(":");
  await assignPatient(clinicId, {
    juniorDoctorUserId: String(formData.get("juniorDoctorUserId")),
    patientId: String(patientId),
    familyMemberId: familyMemberId || undefined,
  });
  revalidatePath(`/${locale}/clinic/${clinicSlug}/staff`);
}

export async function unassignPatientAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  await unassignPatient(clinicId, String(formData.get("assignmentId")));
  revalidatePath(`/${locale}/clinic/${clinicSlug}/staff`);
}

export async function viewClinicRecordAction(
  clinicId: string,
  formData: FormData,
): Promise<void> {
  const { url } = await getClinicRecordSignedUrl(clinicId, String(formData.get("recordId")));
  redirect(url);
}

export async function upsertClinicMedicalSummaryAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  patientId: string,
  formData: FormData,
): Promise<void> {
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
    await upsertFamilyMemberMedicalSummary(clinicId, patientId, String(familyMemberId), input);
    revalidatePath(
      `/${locale}/clinic/${clinicSlug}/patients/${patientId}/family/${String(familyMemberId)}`,
    );
  } else {
    await upsertPatientMedicalSummary(clinicId, patientId, input);
    revalidatePath(`/${locale}/clinic/${clinicSlug}/patients/${patientId}`);
  }
}

export async function saveClinicalNoteAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  appointmentId: string,
  hasExisting: boolean,
  formData: FormData,
): Promise<void> {
  const notes = String(formData.get("notes") ?? "");
  const diagnosis = formData.get("diagnosis") ? String(formData.get("diagnosis")) : undefined;

  if (hasExisting) {
    await updateClinicalNote(clinicId, appointmentId, { notes, diagnosis });
  } else {
    await createClinicalNote(clinicId, { appointmentId, notes, diagnosis });
  }
  revalidatePath(`/${locale}/clinic/${clinicSlug}/clinical-notes/${appointmentId}`);
}

const PRESCRIPTION_ROWS = 8;

export async function saveClinicalPrescriptionAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  appointmentId: string,
  formData: FormData,
): Promise<void> {
  const items = [];
  for (let i = 1; i <= PRESCRIPTION_ROWS; i++) {
    const drugName = String(formData.get(`drugName${i}`) ?? "").trim();
    if (!drugName) continue;
    items.push({
      drugName,
      dosage: String(formData.get(`dosage${i}`) ?? "").trim() || undefined,
      frequency: String(formData.get(`frequency${i}`) ?? "").trim() || undefined,
      duration: String(formData.get(`duration${i}`) ?? "").trim() || undefined,
      instructions: String(formData.get(`instructions${i}`) ?? "").trim() || undefined,
    });
  }

  const { allergyWarnings } = await savePrescription(clinicId, appointmentId, items);
  const basePath = `/${locale}/clinic/${clinicSlug}/clinical-notes/${appointmentId}`;
  redirect(
    allergyWarnings.length > 0
      ? `${basePath}?warned=${encodeURIComponent(allergyWarnings.join(","))}`
      : basePath,
  );
}

export async function uploadVerificationDocumentAction(
  locale: string,
  clinicSlug: string,
  formData: FormData,
): Promise<void> {
  await uploadVerificationDocument(formData);
  revalidatePath(`/${locale}/clinic/${clinicSlug}/verification`);
}

export async function deleteVerificationDocumentAction(
  locale: string,
  clinicSlug: string,
  formData: FormData,
): Promise<void> {
  await deleteVerificationDocument(String(formData.get("documentId")));
  revalidatePath(`/${locale}/clinic/${clinicSlug}/verification`);
}
