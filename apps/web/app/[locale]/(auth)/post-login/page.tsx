import { redirect } from "next/navigation";
import { getMe, type MeResponse } from "@/lib/api/me";

type ClinicStaffRow = MeResponse["clinicStaff"][number];

/**
 * Role-aware post-auth redirect. The login page's three cards each map to
 * one kind of account, and the card picked decides where you land — even
 * for an account that holds more than one role (e.g. a receptionist who is
 * also a patient somewhere):
 *
 *   roleHint=staff        → the clinic where you're an active receptionist
 *   roleHint=practitioner → the clinic where you're owner / junior doctor,
 *                           or practitioner onboarding if you have no clinic
 *   roleHint=patient      → the patient dashboard
 *
 * The login page already rejects a card the number doesn't hold (see
 * AuthService.checkRoleEligibility), so the hint is trustworthy here. With
 * no hint — a deep link's `next`, or a session that skipped the cards — it
 * falls back to the account's "most senior" role: doctor clinic, then
 * receptionist clinic, then patient, then onboarding for a brand-new
 * account.
 */
export default async function PostLoginPage(props: PageProps<"/[locale]/post-login">) {
  const sp = await props.searchParams;
  const roleHint = typeof sp.roleHint === "string" ? sp.roleHint : undefined;
  const me = await getMe();

  const active = me.clinicStaff.filter((s) => s.status === "active");
  // Owner before junior doctor, so a doctor who owns a clinic and also
  // helps out at another lands on their own.
  const doctorClinic =
    active.find((s) => s.role === "owner") ?? active.find((s) => s.role === "junior_doctor");
  const receptionistClinic = active.find((s) => s.role === "receptionist");

  const toClinic = (s: ClinicStaffRow) => redirect(`/clinic/${s.clinicSlug}/today`);

  if (roleHint === "staff" && receptionistClinic) {
    toClinic(receptionistClinic);
  }
  if (roleHint === "practitioner") {
    if (doctorClinic) {
      toClinic(doctorClinic);
    }
    // A practitioner with no clinic yet (clinic creation didn't finish), or
    // a brand-new account registering as one.
    redirect(`/onboarding/practitioner`);
  }
  if (roleHint === "patient") {
    redirect(`/patient`);
  }

  if (doctorClinic) {
    toClinic(doctorClinic);
  }
  if (me.practitioner) {
    redirect(`/onboarding/practitioner`);
  }
  if (receptionistClinic) {
    toClinic(receptionistClinic);
  }
  if (me.patient) {
    redirect(`/patient`);
  }
  // Brand new account, nothing decided yet, and no card picked.
  redirect(`/onboarding`);
}
