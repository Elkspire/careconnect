import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default async function PatientLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  const t = await getTranslations("patient");

  const navItems: Array<{
    href: "/patient" | "/" | "/patient/appointments" | "/patient/family" | "/patient/vault" | "/patient/notifications";
    label: string;
  }> = [
    { href: "/patient", label: t("dashboardHeading") },
    // Booking a new appointment starts from the directory search (pick a
    // doctor, then a clinic) — "Appointments" below only ever showed
    // *existing* bookings, with nothing in the patient area pointing back
    // at the directory to start a new one.
    { href: "/", label: t("findDoctor") },
    { href: "/patient/appointments", label: t("appointmentsHeading") },
    { href: "/patient/family", label: t("familyMembersHeading") },
    { href: "/patient/vault", label: t("vaultHeading") },
    { href: "/patient/notifications", label: t("notificationsHeading") },
  ];

  return (
    <div className="dash-shell flex flex-1 flex-col md:flex-row">
      <aside className="dash-sidebar">
        <nav className="flex flex-row overflow-x-auto md:flex-col md:overflow-visible md:py-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} locale={locale as AppLocale} className="dash-navlink tap-target">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="dash-main">{props.children}</main>
    </div>
  );
}
