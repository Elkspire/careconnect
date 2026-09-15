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

  if (!me.practitioner) {
    const languages = String(formData.get("languages") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const specialtyIds = formData.getAll("specialtyIds").map(String);

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

  redirect(`/${locale}/clinic/${clinic.slug}/today`);
}
