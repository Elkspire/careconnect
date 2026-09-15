import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getMyProfile, listFamilyMembers } from "@/lib/api/patients";
import { listMyAppointments } from "@/lib/api/booking";
import { listVaultRecords } from "@/lib/api/vault";
import { PushNotifications } from "@/components/push-notifications";
import { saveProfileAction } from "../actions";

export default async function PatientDashboardPage(props: PageProps<"/[locale]/patient">) {
  const { locale } = await props.params;
  const [t, tOnboarding, profile, familyMembers, appointments, records] = await Promise.all([
    getTranslations("patient"),
    getTranslations("onboarding"),
    getMyProfile(),
    listFamilyMembers(),
    listMyAppointments(),
    listVaultRecords(),
  ]);
  const action = saveProfileAction.bind(null, locale);
  const upcomingCount = appointments.filter((a) => a.status === "booked").length;

  return (
    <div className="max-w-5xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("dashboardHeading")}</h1>

      <div className="stats mt-6">
        <div className="stat">
          <b>{upcomingCount}</b>
          <em>{t("appointmentsHeading")}</em>
        </div>
        <div className="stat">
          <b>{familyMembers.length}</b>
          <em>{t("familyMembersHeading")}</em>
        </div>
        <div className="stat">
          <b>{records.length}</b>
          <em>{t("vaultHeading")}</em>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="slip">
          {!profile && (
            <div className="alert mb-5">
              <div>
                <b>{t("createProfilePrompt")}</b>
              </div>
            </div>
          )}

          <form action={action} className="flex flex-col gap-4">
            <label>
              <span className="lbl">{t("fullNameLabel")}</span>
              <input
                type="text"
                name="fullName"
                required
                defaultValue={profile?.fullName}
                className="field tap-target"
              />
            </label>
            <label>
              <span className="lbl">{t("preferredLanguageLabel")}</span>
              <select
                name="preferredLanguage"
                defaultValue={profile?.preferredLanguage ?? locale}
                className="field tap-target"
              >
                <option value="en">English</option>
                <option value="ur">اردو</option>
              </select>
            </label>
            <button type="submit" className="btn tap-target self-start">
              {t("saveProfile")}
            </button>
          </form>
        </div>

        <div className="slip">
          <h4 className="lbl">{t("preferencesHeading")}</h4>
          <PushNotifications />
        </div>
      </div>

      <Link
        href="/onboarding/practitioner"
        locale={locale as AppLocale}
        className="mono mt-6 inline-block text-xs"
        style={{ color: "var(--color-ink-soft)" }}
      >
        {tOnboarding("becomeProviderLink")}
      </Link>
    </div>
  );
}
