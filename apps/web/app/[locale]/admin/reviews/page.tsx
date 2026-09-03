import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listHiddenReviews, listReportedReviews } from "@/lib/api/admin";
import { StarRating } from "@/components/star-rating";
import { formatClinicDate } from "@/lib/format-time";
import { hideReviewAction, unhideReviewAction } from "../actions";

export default async function AdminReviewsPage(
  props: PageProps<"/[locale]/admin/reviews">,
) {
  const { locale } = await props.params;
  const t = await getTranslations("admin");
  const hide = hideReviewAction.bind(null, locale);
  const unhide = unhideReviewAction.bind(null, locale);

  const [reported, hidden] = await Promise.all([
    listReportedReviews().catch(() => null),
    listHiddenReviews().catch(() => null),
  ]);

  if (reported === null || hidden === null) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <div className="locked">
          <div className="lockmsg">
            <span className="mono">{t("accessDenied")}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <nav className="mt-2 flex gap-4 text-sm">
        <Link href="/admin/practitioners" locale={locale} style={{ color: "var(--color-ink-soft)" }}>
          {t("navPractitioners")}
        </Link>
        <span style={{ color: "var(--color-verified)" }}>{t("navReviews")}</span>
      </nav>
      <h1 className="disp mt-2 text-2xl font-bold">{t("reviewsHeading")}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {t("reviewsScopeNote")}
      </p>

      {reported.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("noReportedReviews")}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {reported.map((r) => (
            <li key={r.reportId} className="chart">
              <div className="cn">
                <b>{r.practitionerFullName}</b>
                <small>
                  {t("reportedByLabel")} {formatClinicDate(r.reportedAt, locale)}
                </small>
              </div>
              <StarRating rating={r.rating} />
              {r.comment && <p>{r.comment}</p>}
              <p className="mt-2 text-sm" style={{ color: "var(--color-seal)" }}>
                {r.reason}
              </p>
              <form action={hide} className="mt-3">
                <input type="hidden" name="reviewId" value={r.reviewId} />
                <button type="submit" className="btn sm tap-target">
                  {t("hide")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
        {t("hiddenReviewsHeading")}
      </h2>
      {hidden.length === 0 ? (
        <p className="mt-3" style={{ color: "var(--color-ink-soft)" }}>
          {t("noHiddenReviews")}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {hidden.map((r) => (
            <li key={r.id} className="chart">
              <div className="cn">
                <b>{r.practitionerFullName}</b>
              </div>
              <StarRating rating={r.rating} />
              {r.comment && <p>{r.comment}</p>}
              <form action={unhide} className="mt-3">
                <input type="hidden" name="reviewId" value={r.id} />
                <button type="submit" className="btn gh sm tap-target">
                  {t("unhide")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
