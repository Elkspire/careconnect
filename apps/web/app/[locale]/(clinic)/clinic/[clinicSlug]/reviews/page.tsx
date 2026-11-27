import { Star } from "lucide-react";
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
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/overlay";

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
                <div className="mt-2">
                  <Modal
                    trigger={t("reportReview")}
                    triggerVariant="link"
                    title={t("reportReview")}
                    description={review.comment ?? undefined}
                    formAction={report}
                    submitLabel={t("submitReport")}
                    submitTone="danger"
                  >
                    <input type="hidden" name="reviewId" value={review.id} />
                    <FormField label={t("reportReasonLabel")}>
                      <textarea
                        name="reason"
                        required
                        rows={3}
                        className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600"
                      />
                    </FormField>
                  </Modal>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
