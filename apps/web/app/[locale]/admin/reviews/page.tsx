import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listHiddenReviews, listReportedReviews } from "@/lib/api/admin";
import { StarRating } from "@/components/star-rating";
import { formatClinicDate } from "@/lib/format-time";
import { hideReviewAction, unhideReviewAction } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { AdminTabs } from "@/components/admin-tabs";

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
        <Alert tone="warning" title={t("accessDenied")} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <AdminTabs active="reviews" />
      <PageHeader
        icon={Star}
        kicker="CareConnect"
        title={t("reviewsHeading")}
        description={t("reviewsScopeNote")}
      />

      {reported.length === 0 ? (
        <EmptyState icon={Star} title={t("noReportedReviews")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {reported.map((r) => (
            <li key={r.reportId}>
              <Card padding="lg">
                <b className="font-semibold text-text">{r.practitionerFullName}</b>
                <p className="text-sm text-text-muted">
                  {t("reportedByLabel")} {formatClinicDate(r.reportedAt, locale)}
                </p>
                <div className="mt-2">
                  <StarRating rating={r.rating} />
                </div>
                {r.comment && <p className="mt-1 text-sm text-text">{r.comment}</p>}
                <p className="mt-2 text-sm text-danger-fg">{r.reason}</p>
                <form action={hide} className="mt-3">
                  <input type="hidden" name="reviewId" value={r.reviewId} />
                  <SubmitButton
                    className="tap-target rounded-md bg-primary-700 px-3 py-1.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
                  >
                    {t("hide")}
                  </SubmitButton>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-8 text-base font-bold text-text">
        {t("hiddenReviewsHeading")}
      </h2>
      {hidden.length === 0 ? (
        <EmptyState icon={Star} title={t("noHiddenReviews")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {hidden.map((r) => (
            <li key={r.id}>
              <Card padding="lg">
                <b className="font-semibold text-text">{r.practitionerFullName}</b>
                <div className="mt-2">
                  <StarRating rating={r.rating} />
                </div>
                {r.comment && <p className="mt-1 text-sm text-text">{r.comment}</p>}
                <form action={unhide} className="mt-3">
                  <input type="hidden" name="reviewId" value={r.id} />
                  <SubmitButton
                    className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
                  >
                    {t("unhide")}
                  </SubmitButton>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
