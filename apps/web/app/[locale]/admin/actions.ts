"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { FormResult } from "@/lib/form-result";
import {
  getDocumentSignedUrl,
  hideReview,
  rejectPractitioner,
  unhideReview,
  verifyPractitioner,
} from "@/lib/api/admin";

export async function verifyPractitionerAction(locale: string, formData: FormData): Promise<void> {
  await verifyPractitioner(String(formData.get("practitionerId")));
  revalidatePath(`/${locale}/admin/practitioners`);
}

export async function rejectPractitionerAction(
  locale: string,
  formData: FormData,
): Promise<FormResult> {
  const reason = String(formData.get("reason") ?? "").trim();
  await rejectPractitioner(String(formData.get("practitionerId")), { reason });
  revalidatePath(`/${locale}/admin/practitioners`);
  return { status: "success", message: (await getTranslations("admin"))("rejected") };
}

export async function hideReviewAction(locale: string, formData: FormData): Promise<void> {
  await hideReview(String(formData.get("reviewId")));
  revalidatePath(`/${locale}/admin/reviews`);
}

export async function unhideReviewAction(locale: string, formData: FormData): Promise<void> {
  await unhideReview(String(formData.get("reviewId")));
  revalidatePath(`/${locale}/admin/reviews`);
}

export async function viewVerificationDocumentAction(formData: FormData): Promise<void> {
  const { url } = await getDocumentSignedUrl(String(formData.get("documentId")));
  redirect(url);
}
