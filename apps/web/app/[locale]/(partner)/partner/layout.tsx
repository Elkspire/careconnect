import { LayoutDashboard } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";

/**
 * The lab and pharmacy partner workspace. Only its frame exists so far:
 * there are no partner accounts, data or API yet, so it's hidden in a
 * production build unless the server runs with PARTNER_PREVIEW=1.
 */
export default async function PartnerLayout(props: LayoutProps<"/[locale]/partner">) {
  if (process.env.NODE_ENV !== "development" && process.env.PARTNER_PREVIEW !== "1") {
    notFound();
  }
  const t = await getTranslations("partner");
  return (
    <AppShell
      subtitle={t("workspaceLabel")}
      navLabel={t("workspaceLabel")}
      home="/partner"
      title={t("workspaceLabel")}
      description={t("previewNote")}
      user={{ name: t("previewUser"), role: t("previewRole") }}
      nav={[
        {
          href: "/partner",
          label: t("nav.overview"),
          icon: <LayoutDashboard aria-hidden className="size-[18px] shrink-0" />,
          exact: true,
        },
      ]}
    >
      {props.children}
    </AppShell>
  );
}
