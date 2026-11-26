import { CalendarCheck, FolderHeart, LayoutDashboard, UserX, Users } from "lucide-react";
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
import { LanguageSelectField } from "@/components/language-select-field";

export default async function PatientDashboardPage(props: PageProps<"/[locale]/patient">) {
  const { locale } = await props.params;
  const profileError = (await props.searchParams).profileError === "1";
  const [t, tOnboarding, tAccount, profile, familyMembers, appointments, records] = await Promise.all([
    getTranslations("patient"),
    getTranslations("onboarding"),
    getTranslations("account"),
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
          {profileError && (
            <div className="mb-5">
              <Alert tone="danger" title={t("profileSaveError")} />
            </div>
          )}

          <form action={action} className="flex flex-col gap-4">
            <FormField label={t("fullNameLabel")}>
              <input
                type="text"
                name="fullName"
                required
                defaultValue={profile?.fullName}
                className="tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600"
              />
            </FormField>
            <LanguageSelectField
              name="preferredLanguage"
              label={t("preferredLanguageLabel")}
              // The site's current language, not the saved one: the two are
              // kept in sync (see saveLocaleAction), and this way Settings
              // can never disagree with the header.
              defaultValue={locale as AppLocale}
            />
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
          <div className="mt-5 border-t border-border pt-4">
            <Link href="/account/delete" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-danger-fg">
              <UserX aria-hidden className="size-4" />
              {tAccount("link")}
            </Link>
          </div>
        </Card>
      </div>

      <Link
        href="/onboarding/practitioner"
        className="mt-6 inline-block text-xs font-medium text-text-muted hover:text-text"
      >
        {tOnboarding("becomeProviderLink")}
      </Link>
    </div>
  );
}
