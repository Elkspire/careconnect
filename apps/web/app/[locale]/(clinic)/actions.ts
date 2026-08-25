"use server";

import { revalidatePath } from "next/cache";
import { checkIn, inviteStaff, revokeStaff } from "@/lib/api/clinic";
import { createClinicalNote, updateClinicalNote } from "@/lib/api/clinical";

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
  await inviteStaff(clinicId, {
    clinicId,
    phone: String(formData.get("phone")),
    fullName: String(formData.get("fullName") ?? ""),
    role: "receptionist",
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
