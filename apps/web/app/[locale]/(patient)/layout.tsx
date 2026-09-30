import { Bell, CalendarCheck, FolderHeart, LayoutDashboard, Search, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Sidebar, SidebarNav, SidebarLink, SidebarMain } from "@/components/ui/sidebar";

export default async function PatientLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  const t = await getTranslations("patient");

  const navItems = [
    { href: "/patient", label: t("dashboardHeading"), icon: LayoutDashboard },
    // Booking a new appointment starts from the directory search (pick a
    // doctor, then a clinic) — "Appointments" below only ever showed
    // *existing* bookings, with nothing in the patient area pointing back
    // at the directory to start a new one.
    { href: "/directory", label: t("findDoctor"), icon: Search },
    { href: "/patient/appointments", label: t("appointmentsHeading"), icon: CalendarCheck },
    { href: "/patient/family", label: t("familyMembersHeading"), icon: Users },
    { href: "/patient/vault", label: t("vaultHeading"), icon: FolderHeart },
    { href: "/patient/notifications", label: t("notificationsHeading"), icon: Bell },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8">
      <Sidebar>
        <SidebarNav>
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={<item.icon aria-hidden className="size-4.5 shrink-0" />}
              label={item.label}
              locale={locale as AppLocale}
            />
          ))}
        </SidebarNav>
        <SidebarMain>{props.children}</SidebarMain>
      </Sidebar>
    </div>
  );
}
