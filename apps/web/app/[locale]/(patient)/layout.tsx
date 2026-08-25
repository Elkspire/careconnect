import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function PatientLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  const t = await getTranslations("patient");

  return (
    <div className="flex flex-1 flex-col">
      <nav className="border-b border-line bg-bottle-2">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-1 px-4 py-2">
          <Link href="/patient" locale={locale} className="navlink tap-target flex items-center">
            {t("dashboardHeading")}
          </Link>
          <Link
            href="/patient/appointments"
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("appointmentsHeading")}
          </Link>
          <Link
            href="/patient/family"
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("familyMembersHeading")}
          </Link>
          <Link
            href="/patient/vault"
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("vaultHeading")}
          </Link>
          <Link
            href="/patient/notifications"
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("notificationsHeading")}
          </Link>
        </div>
      </nav>
      {props.children}
    </div>
  );
}
