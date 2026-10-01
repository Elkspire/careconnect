import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/me";

/**
 * Role-aware post-auth redirect: a clinic-staff session (owner or
 * receptionist, active) goes to the clinic dashboard; an existing patient
 * goes to the patient dashboard. A brand-new session with none of
 * patient/practitioner/active-staff — used to fall through to /patient
 * unconditionally, silently turning every new sign-up into a patient with
 * no way to say otherwise — now goes to /onboarding to actually choose,
 * unless the login page's role cards already captured that choice (see
 * roleHint below), in which case it skips straight to the matching flow.
 * A practitioner row with no active staff yet (clinic creation didn't
 * finish) goes straight back into that form rather than the role choice,
 * since the role is already decided.
 */
export default async function PostLoginPage(props: PageProps<"/[locale]/post-login">) {
  const { locale } = await props.params;
  const sp = await props.searchParams;
  const roleHint = typeof sp.roleHint === "string" ? sp.roleHint : undefined;
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
  // Brand new account, nothing decided yet — only here does the login
  // page's role card (if any) matter; an existing patient/practitioner/
  // staff account always lands on its real destination above regardless
  // of which card they happened to click.
  if (roleHint === "patient") {
    redirect(`/${locale}/patient`);
  }
  if (roleHint === "practitioner") {
    redirect(`/${locale}/onboarding/practitioner`);
  }
  redirect(`/${locale}/onboarding`);
}
