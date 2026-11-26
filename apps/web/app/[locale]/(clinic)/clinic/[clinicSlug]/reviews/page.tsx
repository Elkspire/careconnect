import { ChevronDown, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPractitionerReviews } from "@/lib/api/reviews";
import { getMe, resolveClinicStaffBySlug } from "@/lib/api/me";
import { StarRating } from "@/components/star-rating";
import { formatClinicDate } from "@/lib/format-time";
import { reportReviewAction } from "../../../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

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
        <Alert tone="warning" title={t("accessDenied")} />
      </div>
    );
  }

  const { reviews } = await getPractitionerReviews(me.practitioner.id);
  const report = reportReviewAction.bind(null, locale, clinicSlug, me.practitioner.id);

  return (
    <div className="max-w-2xl">
      <PageHeader
        icon={Star}
        kicker="CareConnect"
        title={t("reviewsHeading")}
        description={t("reviewsPrompt")}
      />

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title={t("noReviewsYet")} />
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-border">
            {reviews.map((review) => (
              <div key={review.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <StarRating rating={review.rating} />
                  <span className="text-xs text-text-muted">
                    {formatClinicDate(review.createdAt, locale)}
                  </span>
                </div>
                {review.comment && <p className="mt-1 text-sm text-text">{review.comment}</p>}
                <details className="group mt-2">
                  <summary className="tap-target flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-semibold text-text-muted">
                    {t("reportReview")}
                    <ChevronDown aria-hidden className="size-3.5 transition group-open:rotate-180" />
                  </summary>
                  <form action={report} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-text-label">
                        {t("reportReasonLabel")}
                      </span>
                      <textarea
                        name="reason"
                        required
                        rows={2}
                        className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600"
                      />
                    </label>
                    <SubmitButton
                      className="tap-target self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg"
                    >
                      {t("submitReport")}
                    </SubmitButton>
                  </form>
                </details>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
