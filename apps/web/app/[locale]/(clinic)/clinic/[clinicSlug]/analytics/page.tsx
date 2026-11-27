import { BarChart3, CalendarCheck, CalendarX, UserX, Users, Wallet } from "lucide-react";
import { intlLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getClinicAnalytics } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/data-table";
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

      <KpiGrid>
        <KpiCard icon={CalendarCheck} value={analytics.totals.visits} label={t("totalVisitsLabel")} />
        <KpiCard
          icon={Users}
          tone="blue"
          value={analytics.totals.uniquePatients}
          label={t("uniquePatientsLabel")}
        />
        <KpiCard icon={CalendarX} tone="amber" value={analytics.totals.cancelled} label={t("cancelledLabel")} />
        <KpiCard icon={UserX} tone="red" value={analytics.totals.noShows} label={t("noShowsLabel")} />
        <KpiCard
          icon={Wallet}
          tone="purple"
          value={analytics.totals.estimatedRevenue.toLocaleString(intlLocale(locale))}
          label={t("estimatedRevenueLabel")}
          hint={t("revenueDisclaimer")}
        />
      </KpiGrid>

      {!hasActivity ? (
        <div className="mt-8">
          <EmptyState icon={BarChart3} title={t("noActivityYet")} />
        </div>
      ) : (
        <>
          <h2 className="mb-3 mt-8 text-base font-bold text-text">
            {t("dailyBreakdownHeading")}
          </h2>
          <DataTable
            caption={t("dailyBreakdownHeading")}
            initialSort={{ key: "day", direction: "descending" }}
            columns={[
              { key: "day", header: t("dayLabel"), sortable: true },
              { key: "visits", header: t("totalVisitsLabel"), sortable: true, align: "end" },
              { key: "cancelled", header: t("cancelledLabel"), sortable: true, align: "end" },
              { key: "noShows", header: t("noShowsLabel"), sortable: true, align: "end" },
              { key: "revenue", header: t("estimatedRevenueLabel"), sortable: true, align: "end" },
            ]}
            rows={analytics.daily.map((d) => ({
              key: d.day,
              sortValues: {
                day: new Date(d.day),
                visits: d.visits,
                cancelled: d.cancelled,
                noShows: d.noShows,
                revenue: Number(d.estimatedRevenue),
              },
              cells: {
                day: formatClinicDate(d.day, locale),
                visits: d.visits,
                cancelled: d.cancelled,
                noShows: d.noShows,
                revenue: Number(d.estimatedRevenue).toLocaleString(intlLocale(locale)),
              },
            }))}
          />

          {analytics.byPractitioner.length > 1 && (
            <>
              <h2 className="mb-3 mt-8 text-base font-bold text-text">
                {t("byPractitionerHeading")}
              </h2>
              <DataTable
                caption={t("byPractitionerHeading")}
                initialSort={{ key: "visits", direction: "descending" }}
                columns={[
                  { key: "name", header: t("practitionerLabel"), sortable: true },
                  { key: "visits", header: t("totalVisitsLabel"), sortable: true, align: "end" },
                ]}
                rows={analytics.byPractitioner.map((p) => ({
                  key: p.practitionerId,
                  sortValues: { name: p.practitionerFullName, visits: p.visits },
                  cells: { name: p.practitionerFullName, visits: p.visits },
                }))}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
