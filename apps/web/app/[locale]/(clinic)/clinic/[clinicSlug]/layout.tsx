import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { resolveClinicStaffBySlug } from "@/lib/api/me";

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
    { href: `/clinic/${clinicSlug}/today`, label: t("nav.today") },
    { href: `/clinic/${clinicSlug}/patients`, label: t("nav.patients") },
    ...(!staffCtx || staffCtx.role === "owner"
      ? [{ href: `/clinic/${clinicSlug}/staff`, label: t("nav.staff") }]
      : []),
    { href: `/clinic/${clinicSlug}/notifications`, label: t("nav.notifications") },
  ];

  return (
    <div className="dash-shell flex flex-1 flex-col md:flex-row">
      <aside className="dash-sidebar">
        <nav className="flex flex-row overflow-x-auto md:flex-col md:overflow-visible md:py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              locale={locale as AppLocale}
              className="dash-navlink tap-target"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="dash-main">{props.children}</main>
    </div>
  );
}
