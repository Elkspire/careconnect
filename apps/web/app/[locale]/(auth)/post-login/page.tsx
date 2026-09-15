import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/me";

/**
 * Role-aware post-auth redirect: a clinic-staff session (owner or
 * receptionist, active) goes to the clinic dashboard; an existing patient
 * goes to the patient dashboard. A brand-new session with none of
 * patient/practitioner/active-staff — used to fall through to /patient
 * unconditionally, silently turning every new sign-up into a patient with
 * no way to say otherwise — now goes to /onboarding to actually choose.
 * A practitioner row with no active staff yet (clinic creation didn't
 * finish) goes straight back into that form rather than the role choice,
 * since the role is already decided.
 */
export default async function PostLoginPage(props: PageProps<"/[locale]/post-login">) {
  const { locale } = await props.params;
  const me = await getMe();

  const activeStaff = me.clinicStaff.find((s) => s.status === "active");
  if (activeStaff) {
    redirect(`/${locale}/clinic/${activeStaff.clinicSlug}/today`);
  }
  if (me.practitioner) {
    redirect(`/${locale}/onboarding/practitioner`);
  }
  if (me.patient) {
    redirect(`/${locale}/patient`);
  }
  redirect(`/${locale}/onboarding`);
}
