import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPractitionerReviews } from "@/lib/api/reviews";
import { getMe, resolveClinicStaffBySlug } from "@/lib/api/me";
import { StarRating } from "@/components/star-rating";
import { formatClinicDate } from "@/lib/format-time";
import { reportReviewAction } from "../../../actions";

export default async function ClinicReviewsPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/reviews">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, staffCtx, me] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
    getMe(),
  ]);
  if (!staffCtx) {
    notFound();
  }

  // Owner-only, same independent-check pattern as the Staff/Analytics
  // pages — reviews are per-practitioner, not per-clinic, so this only
  // ever shows the owner's own reviews (an owner is always a
  // practitioner themselves), never a junior doctor's.
  if (staffCtx.role !== "owner" || !me.practitioner) {
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

  const { reviews } = await getPractitionerReviews(me.practitioner.id);
  const report = reportReviewAction.bind(null, locale, clinicSlug, me.practitioner.id);

  return (
    <div className="max-w-2xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("reviewsHeading")}</h1>
      <p style={{ color: "var(--color-ink-soft)" }}>{t("reviewsPrompt")}</p>

      {reviews.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("noReviewsYet")}
        </p>
      ) : (
        <div className="card mt-6">
          {reviews.map((review) => (
            <div key={review.id} className="review">
              <div className="flex items-center justify-between gap-3">
                <StarRating rating={review.rating} />
                <span className="mono text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  {formatClinicDate(review.createdAt, locale)}
                </span>
              </div>
              {review.comment && <p>{review.comment}</p>}
              <details className="mt-2">
                <summary
                  className="mono tap-target text-xs"
                  style={{ color: "var(--color-ink-soft)", cursor: "pointer" }}
                >
                  {t("reportReview")}
                </summary>
                <form action={report} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <label>
                    <span className="lbl">{t("reportReasonLabel")}</span>
                    <textarea name="reason" required rows={2} className="field" />
                  </label>
                  <button type="submit" className="btn sm tap-target self-start">
                    {t("submitReport")}
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
