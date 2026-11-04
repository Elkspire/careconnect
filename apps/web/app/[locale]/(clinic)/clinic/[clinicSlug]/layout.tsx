import { BarChart3, Bell, CalendarDays, Clock, ShieldCheck, Star, UserCog, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getMe } from "@/lib/api/me";
import { ClinicSwitcher } from "@/components/clinic-switcher";
import { Sidebar, SidebarNav, SidebarLink, SidebarMain } from "@/components/ui/sidebar";

export default async function ClinicLayout(
  props: LayoutProps<"/[locale]/clinic/[clinicSlug]">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, me] = await Promise.all([getTranslations("clinic"), getMe()]);
  // Same lookup resolveClinicStaffBySlug does, inlined so the one /me call
  // also feeds the clinic switcher below.
  const activeClinics = me.clinicStaff.filter((s) => s.status === "active");
  const staffCtx = activeClinics.find((s) => s.clinicSlug === clinicSlug) ?? null;

  // Staff management is owner-only (per the product doc's role matrix), so
  // the nav link is hidden for receptionist/junior doctor rather than
  // linking to a page that just shows "access denied" — the page still
  // enforces this itself independently, this is purely nav tidiness.
  const navItems = [
    { href: `/clinic/${clinicSlug}/today`, label: t("nav.today"), icon: CalendarDays },
    { href: `/clinic/${clinicSlug}/patients`, label: t("nav.patients"), icon: Users },
    ...(!staffCtx || staffCtx.role === "owner"
      ? [
          { href: `/clinic/${clinicSlug}/schedule`, label: t("nav.schedule"), icon: Clock },
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
        <div className="flex min-w-0 shrink-0 flex-col gap-3 md:w-56">
          <ClinicSwitcher
            heading={t("switcherHeading")}
            clinics={activeClinics.map((s) => ({
              clinicSlug: s.clinicSlug,
              clinicName: s.clinicName,
              roleLabel: t(`roles.${s.role}` as "roles.owner"),
            }))}
            currentSlug={clinicSlug}
            locale={locale as AppLocale}
          />
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
        </div>
        <SidebarMain>{props.children}</SidebarMain>
      </Sidebar>
    </div>
  );
}
