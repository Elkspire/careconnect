import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getClinicAnalytics } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate } from "@/lib/format-time";

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
        <div className="locked">
          <div className="lockmsg">
            <span className="mono">{t("accessDenied")}</span>
          </div>
        </div>
      </div>
    );
  }

  const analytics = await getClinicAnalytics(staffCtx.clinicId);
  const hasActivity = analytics.daily.length > 0;

  return (
    <div className="max-w-4xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("analyticsHeading")}</h1>
      <p style={{ color: "var(--color-ink-soft)" }}>{t("windowLabel")}</p>

      <div className="stats mt-6">
        <div className="stat">
          <b>{analytics.totals.visits}</b>
          <em>{t("totalVisitsLabel")}</em>
        </div>
        <div className="stat">
          <b>{analytics.totals.uniquePatients}</b>
          <em>{t("uniquePatientsLabel")}</em>
        </div>
        <div className="stat">
          <b>{analytics.totals.cancelled}</b>
          <em>{t("cancelledLabel")}</em>
        </div>
        <div className="stat">
          <b>{analytics.totals.noShows}</b>
          <em>{t("noShowsLabel")}</em>
        </div>
        <div className="stat">
          <b>{analytics.totals.estimatedRevenue.toLocaleString(locale)}</b>
          <em>{t("estimatedRevenueLabel")}</em>
        </div>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
        {t("revenueDisclaimer")}
      </p>

      {!hasActivity ? (
        <p className="mt-8" style={{ color: "var(--color-ink-soft)" }}>
          {t("noActivityYet")}
        </p>
      ) : (
        <>
          <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
            {t("dailyBreakdownHeading")}
          </h2>
          <div className="pgrid mt-3">
            {analytics.daily.map((d) => (
              <div key={d.day} className="trow">
                <span>{formatClinicDate(d.day, locale)}</span>
                <b className="mono">
                  {d.visits} · {t("cancelledLabel")} {d.cancelled} · {t("noShowsLabel")}{" "}
                  {d.noShows} ·{" "}
                  {Number(d.estimatedRevenue).toLocaleString(locale)}
                </b>
              </div>
            ))}
          </div>

          {analytics.byPractitioner.length > 1 && (
            <>
              <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
                {t("byPractitionerHeading")}
              </h2>
              <div className="pgrid mt-3">
                {analytics.byPractitioner.map((p) => (
                  <div key={p.practitionerId} className="trow">
                    <span>{p.practitionerFullName}</span>
                    <b className="mono">{p.visits}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
