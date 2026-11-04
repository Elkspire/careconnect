import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPractitionerProfile } from "@/lib/api/directory";
import { getPractitionerReviews } from "@/lib/api/reviews";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/star-rating";
import { formatClinicDate } from "@/lib/format-time";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { submitReviewAction } from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { localizedName } from "@/i18n/routing";

export default async function PractitionerProfilePage(
  props: PageProps<"/[locale]/practitioners/[slug]">,
) {
  const { locale, slug } = await props.params;
  const [t, profile] = await Promise.all([
    getTranslations("practitionerProfile"),
    getPractitionerProfile(slug),
  ]);

  if (!profile) {
    notFound();
  }

  const [{ summary, reviews }, supabase] = await Promise.all([
    getPractitionerReviews(profile.id),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const action = submitReviewAction.bind(null, locale, slug, profile.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/directory"
        locale={locale}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("backToDirectory")}
      </Link>

      <Card padding="lg" className="mt-4">
        <h1 className="text-2xl font-bold text-text">{profile.fullName}</h1>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary-600">
          {profile.practitionerType}
        </p>

        {profile.bio && <p className="mt-3 text-sm text-text-muted">{profile.bio}</p>}

        {profile.specialties.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("specialtiesLabel")}
            </p>
            <p className="mt-1 text-sm text-text">
              {profile.specialties.map((s) => localizedName(s, locale)).join(", ")}
            </p>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("ratingLabel")}
          </p>
          {summary.averageRating === null ? (
            <p className="mt-1 text-sm text-text-muted">{t("noReviewsYet")}</p>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold text-text">{summary.averageRating.toFixed(1)}</span>
              <StarRating rating={summary.averageRating} />
              <span className="text-xs text-text-muted">
                {t("reviewCount", { count: summary.reviewCount })}
              </span>
            </div>
          )}
        </div>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
        {t("clinicsLabel")}
      </h2>
      <ul className="flex flex-col gap-3">
        {profile.clinics.map((clinic) => (
          <li key={clinic.id}>
            <Card>
              <b className="font-semibold text-text">{clinic.name}</b>
              <p className="mt-1 text-sm text-text-muted">{clinic.address}</p>
              <p className="text-sm text-text-muted">
                {clinic.area}, {clinic.city}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-text">{clinic.consultationFee}</span>
                <Link href={`/patient/book/${profile.slug}/${clinic.slug}`} locale={locale}>
                  <span className="tap-target inline-flex items-center rounded-md bg-primary-700 px-3 py-1.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800">
                    {t("bookAt")}
                  </span>
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
        {t("reviewsLabel")}
      </h2>

      {reviews.length > 0 && (
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
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="lg" className="mt-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          {t("leaveReviewLabel")}
        </h4>
        {user ? (
          <form action={action} className="flex flex-col gap-4">
            <FormField label={t("ratingLabel")}>
              <select
                name="rating"
                required
                defaultValue="5"
                className="tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="5">★★★★★ (5)</option>
                <option value="4">★★★★☆ (4)</option>
                <option value="3">★★★☆☆ (3)</option>
                <option value="2">★★☆☆☆ (2)</option>
                <option value="1">★☆☆☆☆ (1)</option>
              </select>
            </FormField>
            <FormField label={t("commentLabel")}>
              <textarea
                name="comment"
                rows={3}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </FormField>
            <SubmitButton
              className="tap-target self-start rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
            >
              {t("submitReview")}
            </SubmitButton>
            <p className="text-xs text-text-faint">{t("reviewEligibilityNote")}</p>
          </form>
        ) : (
          <p className="text-sm text-text-muted">
            <Link href="/login" locale={locale} className="font-medium text-primary-700 hover:text-primary-800">
              {t("loginToReview")}
            </Link>
          </p>
        )}
      </Card>
    </main>
  );
}
