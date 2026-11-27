import { LayoutGrid, Stethoscope, Users } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getMe } from "@/lib/api/me";
import { AppShell } from "@/components/shell/app-shell";
import { SiteHeader } from "@/components/site-header";
import { Alert } from "@/components/ui/alert";

const icon = "size-5 shrink-0";

/**
 * The front desk workspace: the prototype's narrow icon rail for the
 * reception counter. For whoever runs the desk — a receptionist or the
 * owner; a junior doctor works from the clinic dashboard instead.
 */
export default async function FrontDeskLayout(props: LayoutProps<"/[locale]/desk/[clinicSlug]">) {
  const { clinicSlug } = await props.params;
  const [t, tClinic, format, me] = await Promise.all([
    getTranslations("desk"),
    getTranslations("clinic"),
    getFormatter(),
    getMe(),
  ]);
  const staffCtx = me.clinicStaff.find((s) => s.status === "active" && s.clinicSlug === clinicSlug);

  if (!staffCtx || (staffCtx.role !== "owner" && staffCtx.role !== "receptionist")) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
          <Alert tone="warning" title={tClinic("accessDenied")} />
        </main>
      </>
    );
  }

  const base = `/desk/${clinicSlug}`;
  return (
    <AppShell
      variant="rail"
      subtitle={t("workspaceLabel")}
      navLabel={t("workspaceLabel")}
      home={base}
      title={t("title", { clinic: staffCtx.clinicName })}
      description={format.dateTime(new Date(), { dateStyle: "full", timeZone: "Asia/Karachi" })}
      user={{
        name: me.practitioner?.fullName ?? me.patient?.fullName ?? me.phone ?? "",
        role: tClinic(`roles.${staffCtx.role}` as "roles.owner"),
      }}
      nav={[
        { href: base, label: t("nav.queue"), icon: <LayoutGrid aria-hidden className={icon} />, exact: true },
        { href: `${base}/patients`, label: t("nav.patients"), icon: <Users aria-hidden className={icon} /> },
        {
          href: `/clinic/${clinicSlug}/today`,
          label: t("nav.clinic"),
          icon: <Stethoscope aria-hidden className={icon} />,
        },
      ]}
    >
      {props.children}
    </AppShell>
  );
}
