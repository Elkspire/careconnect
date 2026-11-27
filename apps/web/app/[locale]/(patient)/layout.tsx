import { Bell, CalendarCheck, FolderHeart, LayoutDashboard, Search, Users } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getMe } from "@/lib/api/me";
import { AppShell } from "@/components/shell/app-shell";

const icon = "size-[18px] shrink-0";

/**
 * The patient area in the same workspace frame as the clinic, front desk and
 * admin: navy sidebar, and a top bar greeting the patient with today's date
 * (as on the prototype's home screen). /patient is behind sign-in (proxy.ts).
 */
export default async function PatientLayout(props: LayoutProps<"/[locale]">) {
  const [t, format, me] = await Promise.all([getTranslations("patient"), getFormatter(), getMe()]);
  const name = me.patient?.fullName;

  return (
    <AppShell
      subtitle={t("workspaceLabel")}
      navLabel={t("workspaceLabel")}
      home="/patient"
      // No profile yet (first sign-in, or a doctor opening /patient): the
      // page itself asks for a name.
      title={name ? t("greeting", { name }) : t("dashboardHeading")}
      description={format.dateTime(new Date(), { dateStyle: "full", timeZone: "Asia/Karachi" })}
      user={{ name: name ?? me.practitioner?.fullName ?? me.phone ?? "", role: t("roleLabel") }}
      nav={[
        { href: "/patient", label: t("dashboardHeading"), icon: <LayoutDashboard aria-hidden className={icon} />, exact: true },
        // Booking starts from the directory (pick a doctor, then a clinic),
        // which is a public page outside this frame.
        { href: "/directory", label: t("findDoctor"), icon: <Search aria-hidden className={icon} /> },
        { href: "/patient/appointments", label: t("appointmentsHeading"), icon: <CalendarCheck aria-hidden className={icon} /> },
        { href: "/patient/family", label: t("familyMembersHeading"), icon: <Users aria-hidden className={icon} /> },
        { href: "/patient/vault", label: t("vaultHeading"), icon: <FolderHeart aria-hidden className={icon} /> },
        { href: "/patient/notifications", label: t("notificationsHeading"), icon: <Bell aria-hidden className={icon} /> },
      ]}
    >
      {props.children}
    </AppShell>
  );
}
