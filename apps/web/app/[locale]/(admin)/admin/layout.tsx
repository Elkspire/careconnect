import { BadgeCheck, Flag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listPendingPractitioners, listReportedReviews } from "@/lib/api/admin";
import { getMe } from "@/lib/api/me";
import { AppShell } from "@/components/shell/app-shell";
import { SiteHeader } from "@/components/site-header";

const icon = "size-[18px] shrink-0";

/**
 * The platform admin workspace. Its two queues sit in the sidebar with how
 * much is waiting in each. Someone who isn't an admin gets no admin shell —
 * the pages themselves say they have no access.
 */
export default async function AdminLayout(props: LayoutProps<"/[locale]/admin">) {
  const [t, me, practitioners, reviews] = await Promise.all([
    getTranslations("admin"),
    getMe(),
    listPendingPractitioners().catch(() => null),
    listReportedReviews().catch(() => null),
  ]);
  if (practitioners === null) {
    return (
      <>
        <SiteHeader />
        {props.children}
      </>
    );
  }

  return (
    <AppShell
      subtitle={t("workspaceLabel")}
      navLabel={t("workspaceLabel")}
      home="/admin/practitioners"
      title={t("workspaceLabel")}
      description={t("workspaceDescription")}
      user={{
        name: me.practitioner?.fullName ?? me.patient?.fullName ?? me.phone ?? "",
        role: t("roleLabel"),
      }}
      nav={[
        {
          href: "/admin/practitioners",
          label: t("navPractitioners"),
          icon: <BadgeCheck aria-hidden className={icon} />,
          badge: practitioners.length,
        },
        {
          href: "/admin/reviews",
          label: t("navReviews"),
          icon: <Flag aria-hidden className={icon} />,
          badge: reviews?.length,
        },
      ]}
    >
      {props.children}
    </AppShell>
  );
}
