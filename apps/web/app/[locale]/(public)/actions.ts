"use server";

import { revalidatePath } from "next/cache";
import { submitReview } from "@/lib/api/reviews";

export async function submitReviewAction(
  locale: string,
  practitionerSlug: string,
  practitionerId: string,
  formData: FormData,
): Promise<void> {
  const rating = Number(formData.get("rating"));
  const comment = formData.get("comment") ? String(formData.get("comment")) : undefined;
  await submitReview(practitionerId, { rating, comment });
  revalidatePath(`/${locale}/practitioners/${practitionerSlug}`);
}
