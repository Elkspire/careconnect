"use server";

import { revalidatePath } from "next/cache";
import { rejectPractitioner, verifyPractitioner } from "@/lib/api/admin";

export async function verifyPractitionerAction(locale: string, formData: FormData): Promise<void> {
  await verifyPractitioner(String(formData.get("practitionerId")));
  revalidatePath(`/${locale}/admin/practitioners`);
}

export async function rejectPractitionerAction(locale: string, formData: FormData): Promise<void> {
  const reason = String(formData.get("reason") ?? "").trim();
  await rejectPractitioner(String(formData.get("practitionerId")), { reason });
  revalidatePath(`/${locale}/admin/practitioners`);
}
