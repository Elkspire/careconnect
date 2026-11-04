"use server";

import { redirect } from "next/navigation";
import type { Gender, PractitionerType } from "@careconnect/shared-types";
import { createClinic } from "@/lib/api/clinic";
import { getMe } from "@/lib/api/me";
import { registerPractitioner } from "@/lib/api/practitioners";

/**
 * One form, two API calls: registerPractitioner() only when this session
 * doesn't already have a practitioners row (so this also works as the
 * "finish setting up your clinic" recovery path if a first attempt created
 * the practitioner profile but failed before createClinic — see
 * post-login/page.tsx's redirect logic), then createClinic() always.
 */
export async function registerPractitionerAction(
  locale: string,
  formData: FormData,
): Promise<void> {
  const me = await getMe();
  const formUrl = "/onboarding/practitioner";

  // A plain HTML form can't require "at least one of these checkboxes", and
  // the API rejects an empty list with a 400 — which, thrown from here,
  // used to surface as Next's generic "This page couldn't load" crash.
  // Checked up front so the user gets told which field to fix.
  const specialtyIds = formData.getAll("specialtyIds").map(String);
  if (!me.practitioner && specialtyIds.length === 0) {
    redirect(`${formUrl}?error=specialties`);
  }

  let clinicSlug: string;
  try {
    if (!me.practitioner) {
      const languages = String(formData.get("languages") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await registerPractitioner({
        fullName: String(formData.get("fullName")),
        gender: formData.get("gender") as Gender,
        practitionerType: formData.get("practitionerType") as PractitionerType,
        councilRegistrationNo: String(formData.get("councilRegistrationNo")),
        bio: formData.get("bio") ? String(formData.get("bio")) : undefined,
        languages,
        specialtyIds,
      });
    }

    const clinicPhone = formData.get("clinicPhone");
    const clinic = await createClinic({
      name: String(formData.get("clinicName")),
      city: String(formData.get("clinicCity")),
      area: String(formData.get("clinicArea")),
      address: String(formData.get("clinicAddress")),
      phone: clinicPhone ? String(clinicPhone) : undefined,
    });
    clinicSlug = clinic.slug;
  } catch (err) {
    // Still logged so the real API response shows up in Vercel's logs.
    console.error(err);
    redirect(`${formUrl}?error=failed`);
  }

  // Outside the try: redirect() works by throwing, and the catch above
  // would otherwise swallow it.
  redirect(`/clinic/${clinicSlug}/today`);
}
