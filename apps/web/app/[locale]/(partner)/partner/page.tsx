import { FlaskConical, Pill } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/** What the partner portal will hold (see resources/SCREENS.md, step 5). */
export default async function PartnerOverviewPage() {
  const t = await getTranslations("partner");
  const sections = [
    { icon: FlaskConical, title: t("labTitle"), items: t("labItems").split(" · ") },
    { icon: Pill, title: t("pharmacyTitle"), items: t("pharmacyItems").split(" · ") },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader kicker={t("workspaceLabel")} title={t("overviewHeading")} description={t("overviewBody")} />
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ icon: Icon, title, items }) => (
          <Card key={title} padding="lg">
            <h2 className="flex items-center gap-2 text-base font-bold text-text">
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-primary-50 text-primary-900">
                <Icon aria-hidden className="size-5" />
              </span>
              {title}
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 ps-5 text-sm text-text-muted">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
