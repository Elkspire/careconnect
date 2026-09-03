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
  const role: AssignableStaffRole =
    roleRaw === "junior_doctor" || roleRaw === "assistant" ? roleRaw : "receptionist";
  await inviteStaff(clinicId, {
    clinicId,
    phone: String(formData.get("phone")),
    fullName: String(formData.get("fullName") ?? ""),
    role,
    deniedPermissions: formData
      .getAll("deniedPermissions")
      .map(String)
      .filter((v): v is StaffPermissionKey => (STAFF_PERMISSION_KEY as readonly string[]).includes(v)),
  });
  revalidatePath(`/${locale}/clinic/${clinicSlug}/staff`);
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
