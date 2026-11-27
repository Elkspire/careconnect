import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  MonitorCheck,
  ShieldCheck,
  Star,
  UserCog,
  UserX,
  Users,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getMe } from "@/lib/api/me";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { BranchSwitcher } from "@/components/shell/branch-switcher";

const icon = "size-[18px] shrink-0";

export default async function ClinicLayout(
  props: LayoutProps<"/[locale]/clinic/[clinicSlug]">,
) {
  const { clinicSlug } = await props.params;
  const [t, tAccount, format, me] = await Promise.all([
    getTranslations("clinic"),
    getTranslations("account"),
    getFormatter(),
    getMe(),
  ]);
  // Same lookup resolveClinicStaffBySlug does, inlined so the one /me call
  // also feeds the branch switcher below.
  const activeClinics = me.clinicStaff.filter((s) => s.status === "active");
  const staffCtx = activeClinics.find((s) => s.clinicSlug === clinicSlug) ?? null;
  const role = staffCtx?.role;
  const base = `/clinic/${clinicSlug}`;

  // Owner-only pages are left out for other roles rather than linking to an
  // "access denied" page — each page still enforces this itself.
  const navItems = [
    { href: `${base}/today`, label: t("nav.today"), icon: <CalendarDays aria-hidden className={icon} /> },
    { href: `${base}/patients`, label: t("nav.patients"), icon: <Users aria-hidden className={icon} /> },
    ...(!role || role === "owner"
      ? [
          { href: `${base}/schedule`, label: t("nav.schedule"), icon: <Clock aria-hidden className={icon} /> },
          { href: `${base}/staff`, label: t("nav.staff"), icon: <UserCog aria-hidden className={icon} /> },
          { href: `${base}/analytics`, label: t("nav.analytics"), icon: <BarChart3 aria-hidden className={icon} /> },
          { href: `${base}/reviews`, label: t("nav.reviews"), icon: <Star aria-hidden className={icon} /> },
        ]
      : []),
    // Owners and junior doctors are practitioners with their own
    // verification status; a receptionist isn't.
    ...(!role || role === "owner" || role === "junior_doctor"
      ? [{ href: `${base}/verification`, label: t("nav.verification"), icon: <ShieldCheck aria-hidden className={icon} /> }]
      : []),
    { href: `${base}/notifications`, label: t("nav.notifications"), icon: <Bell aria-hidden className={icon} /> },
    // The front desk is its own workspace (queue and check-in on a rail).
    ...(!role || role === "owner" || role === "receptionist"
      ? [{ href: `/desk/${clinicSlug}`, label: t("nav.frontDesk"), icon: <MonitorCheck aria-hidden className={icon} /> }]
      : []),
  ];

  return (
    <AppShell
      subtitle={t("workspaceLabel")}
      navLabel={t("workspaceLabel")}
      nav={navItems}
      home={`${base}/today`}
      title={staffCtx?.clinicName ?? ""}
      description={format.dateTime(new Date(), { dateStyle: "full", timeZone: "Asia/Karachi" })}
      user={{
        name: me.practitioner?.fullName ?? me.patient?.fullName ?? me.phone ?? "",
        role: role ? t(`roles.${role}` as "roles.owner") : "",
      }}
      sidebarFooter={
        <div className="flex flex-col gap-3">
          <BranchSwitcher
            heading={t("branchLabel")}
            note={t("accessLoggedNote")}
            current={clinicSlug}
            branches={activeClinics.map((s) => ({
              clinicSlug: s.clinicSlug,
              clinicName: s.clinicName,
              roleLabel: t(`roles.${s.role}` as "roles.owner"),
            }))}
          />
          <Link
            href="/account/delete"
            className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-navy-fg no-underline transition hover:text-white"
          >
            <UserX aria-hidden className="size-3.5" />
            {tAccount("link")}
          </Link>
        </div>
      }
    >
      {props.children}
    </AppShell>
  );
}
