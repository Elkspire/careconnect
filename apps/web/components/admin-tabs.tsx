import { getTranslations } from "next-intl/server";
import { listPendingPractitioners, listReportedReviews } from "@/lib/api/admin";
import { Tabs } from "@/components/ui/tabs";

/**
 * The admin area's two queues as tabs, each with how much is waiting in it.
 * Counts are left off if they can't be fetched; the page itself reports that.
 */
export async function AdminTabs({ active }: { active: "practitioners" | "reviews" }) {
  const [t, practitioners, reviews] = await Promise.all([
    getTranslations("admin"),
    listPendingPractitioners().catch(() => null),
    listReportedReviews().catch(() => null),
  ]);
  return (
    <Tabs
      label={t("navLabel")}
      active={active}
      items={[
        {
          key: "practitioners",
          label: t("navPractitioners"),
          count: practitioners?.length,
          href: "/admin/practitioners",
        },
        { key: "reviews", label: t("navReviews"), count: reviews?.length, href: "/admin/reviews" },
      ]}
    />
  );
}
