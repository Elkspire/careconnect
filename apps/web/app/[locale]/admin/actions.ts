"use server";

import { revalidatePath } from "next/cache";
import {
  hideReview,
  rejectPractitioner,
  unhideReview,
  verifyPractitioner,
} from "@/lib/api/admin";

export async function verifyPractitionerAction(locale: string, formData: FormData): Promise<void> {
  await verifyPractitioner(String(formData.get("practitionerId")));
  revalidatePath(`/${locale}/admin/practitioners`);
}

export async function rejectPractitionerAction(locale: string, formData: FormData): Promise<void> {
  const reason = String(formData.get("reason") ?? "").trim();
  await rejectPractitioner(String(formData.get("practitionerId")), { reason });
  revalidatePath(`/${locale}/admin/practitioners`);
}

export async function hideReviewAction(locale: string, formData: FormData): Promise<void> {
  await hideReview(String(formData.get("reviewId")));
  revalidatePath(`/${locale}/admin/reviews`);
}

export async function unhideReviewAction(locale: string, formData: FormData): Promise<void> {
  await unhideReview(String(formData.get("reviewId")));
  revalidatePath(`/${locale}/admin/reviews`);
}
