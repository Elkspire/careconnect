import { BarChart3 } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getClinicAnalytics } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";

export default async function ClinicAnalyticsPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/analytics">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }

  // Owner-only — the API already enforces this (@RequireClinicRole('owner')
  // on ClinicController.getAnalytics), this is a second, independent check
  // so the page itself never even fetches business data for other roles.
  if (staffCtx.role !== "owner") {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title={t("accessDenied")} />
      </div>
    );
  }

  const analytics = await getClinicAnalytics(staffCtx.clinicId);
  const hasActivity = analytics.daily.length > 0;

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={BarChart3}
        kicker="CareConnect"
        title={t("analyticsHeading")}
        description={t("windowLabel")}
      />

      <StatGrid>
        <StatTile value={analytics.totals.visits} label={t("totalVisitsLabel")} />
        <StatTile value={analytics.totals.uniquePatients} label={t("uniquePatientsLabel")} />
        <StatTile value={analytics.totals.cancelled} label={t("cancelledLabel")} />
        <StatTile value={analytics.totals.noShows} label={t("noShowsLabel")} />
        <StatTile
          value={analytics.totals.estimatedRevenue.toLocaleString(locale)}
          label={t("estimatedRevenueLabel")}
        />
      </StatGrid>
      <p className="mt-2 text-xs text-text-faint">{t("revenueDisclaimer")}</p>

      {!hasActivity ? (
        <div className="mt-8">
          <EmptyState icon={BarChart3} title={t("noActivityYet")} />
        </div>
      ) : (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("dailyBreakdownHeading")}
          </h2>
          <Card>
            {analytics.daily.map((d) => (
              <ListRow
                key={d.day}
                title={formatClinicDate(d.day, locale)}
                meta={
                  <>
                    {d.visits} · {t("cancelledLabel")} {d.cancelled} · {t("noShowsLabel")} {d.noShows} ·{" "}
                    {Number(d.estimatedRevenue).toLocaleString(locale)}
                  </>
                }
              />
            ))}
          </Card>

          {analytics.byPractitioner.length > 1 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
                {t("byPractitionerHeading")}
              </h2>
              <Card>
                {analytics.byPractitioner.map((p) => (
                  <ListRow key={p.practitionerId} title={p.practitionerFullName} meta={p.visits} />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
