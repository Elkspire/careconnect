"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BLOOD_GROUP,
  STAFF_PERMISSION_KEY,
  type BloodGroup,
  type StaffPermissionKey,
} from "@careconnect/shared-types";
import {
  checkIn,
  getClinicRecordSignedUrl,
  inviteStaff,
  revokeStaff,
  upsertFamilyMemberMedicalSummary,
  upsertPatientMedicalSummary,
} from "@/lib/api/clinic";
import {
  createClinicalNote,
  savePrescription,
  updateClinicalNote,
} from "@/lib/api/clinical";

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

export async function inviteStaffAction(
  locale: string,
  clinicSlug: string,
  clinicId: string,
  formData: FormData,
): Promise<void> {
  const role = formData.get("role") === "junior_doctor" ? "junior_doctor" : "receptionist";
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
