import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/me";

/**
 * Role-aware post-auth redirect: a clinic-staff session (owner or
 * receptionist, active) goes to the clinic dashboard, everyone else goes to
 * the patient dashboard — matching the plan's shared (auth) infra design.
 * Landed on directly after login when no explicit `next` was requested.
 */
export default async function PostLoginPage(props: PageProps<"/[locale]/post-login">) {
  const { locale } = await props.params;
  const me = await getMe();

  const activeStaff = me.clinicStaff.find((s) => s.status === "active");
  if (activeStaff) {
    redirect(`/${locale}/clinic/${activeStaff.clinicSlug}/today`);
  }
  redirect(`/${locale}/patient`);
}
