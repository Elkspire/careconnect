import { BarChart3, Bell, CalendarDays, ShieldCheck, Star, UserCog, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { Sidebar, SidebarNav, SidebarLink, SidebarMain } from "@/components/ui/sidebar";

export default async function ClinicLayout(
  props: LayoutProps<"/[locale]/clinic/[clinicSlug]">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);

  // Staff management is owner-only (per the product doc's role matrix), so
  // the nav link is hidden for receptionist/junior doctor rather than
  // linking to a page that just shows "access denied" — the page still
  // enforces this itself independently, this is purely nav tidiness.
  const navItems = [
    { href: `/clinic/${clinicSlug}/today`, label: t("nav.today"), icon: CalendarDays },
    { href: `/clinic/${clinicSlug}/patients`, label: t("nav.patients"), icon: Users },
    ...(!staffCtx || staffCtx.role === "owner"
      ? [
          { href: `/clinic/${clinicSlug}/staff`, label: t("nav.staff"), icon: UserCog },
          { href: `/clinic/${clinicSlug}/analytics`, label: t("nav.analytics"), icon: BarChart3 },
          { href: `/clinic/${clinicSlug}/reviews`, label: t("nav.reviews"), icon: Star },
        ]
      : []),
    // Every owner and junior doctor is a practitioner with their own
    // verification status — receptionist isn't a practitioner at all, so
    // the page (and the API underneath it) has nothing to show them.
    ...(!staffCtx || staffCtx.role === "owner" || staffCtx.role === "junior_doctor"
      ? [{ href: `/clinic/${clinicSlug}/verification`, label: t("nav.verification"), icon: ShieldCheck }]
      : []),
    { href: `/clinic/${clinicSlug}/notifications`, label: t("nav.notifications"), icon: Bell },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8">
      <Sidebar>
        <SidebarNav>
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
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
