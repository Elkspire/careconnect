import { CalendarCheck, FolderHeart, LayoutDashboard, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getMyProfile, listFamilyMembers } from "@/lib/api/patients";
import { listMyAppointments } from "@/lib/api/booking";
import { listVaultRecords } from "@/lib/api/vault";
import { PushNotifications } from "@/components/push-notifications";
import { PageHeader } from "@/components/ui/page-header";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { saveProfileAction } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";

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
    <div>
      <PageHeader icon={LayoutDashboard} kicker="CareConnect" title={t("dashboardHeading")} />

      <StatGrid>
        <StatTile icon={CalendarCheck} value={upcomingCount} label={t("appointmentsHeading")} />
        <StatTile icon={Users} value={familyMembers.length} label={t("familyMembersHeading")} />
        <StatTile icon={FolderHeart} value={records.length} label={t("vaultHeading")} />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          {!profile && (
            <div className="mb-5">
              <Alert tone="warning" title={t("createProfilePrompt")} />
            </div>
          )}

          <form action={action} className="flex flex-col gap-4">
            <FormField label={t("fullNameLabel")}>
              <input
                type="text"
                name="fullName"
                required
                defaultValue={profile?.fullName}
                className="tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </FormField>
            <FormField label={t("preferredLanguageLabel")}>
              <select
                name="preferredLanguage"
                defaultValue={profile?.preferredLanguage ?? locale}
                className="tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="en">English</option>
                <option value="ur">اردو</option>
              </select>
            </FormField>
            <SubmitButton
              className="tap-target self-start rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
            >
              {t("saveProfile")}
            </SubmitButton>
          </form>
        </Card>

        <Card padding="lg">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("preferencesHeading")}
          </h4>
          <PushNotifications />
        </Card>
      </div>

      <Link
        href="/onboarding/practitioner"
        locale={locale as AppLocale}
        className="mt-6 inline-block text-xs font-medium text-text-muted hover:text-text"
      >
        {tOnboarding("becomeProviderLink")}
      </Link>
    </div>
  );
}
