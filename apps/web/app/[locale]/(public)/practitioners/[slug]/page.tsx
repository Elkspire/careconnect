import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPractitionerProfile } from "@/lib/api/directory";
import { getPractitionerReviews } from "@/lib/api/reviews";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/star-rating";
import { formatClinicDate } from "@/lib/format-time";
import { submitReviewAction } from "../../actions";

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
      <Link href="/" locale={locale} className="mono text-xs" style={{ color: "var(--color-mint)" }}>
        ← {t("backToDirectory")}
      </Link>

      <div className="slip mt-4">
        <p className="slip-no mono">PMDC · VERIFIED REGISTER</p>
        <h1>{profile.fullName}</h1>
        <p className="mono text-xs" style={{ color: "var(--color-ink-soft)", letterSpacing: "0.1em" }}>
          {profile.practitionerType.toUpperCase()}
        </p>

        {profile.bio && <p className="mt-3">{profile.bio}</p>}

        {profile.specialties.length > 0 && (
          <>
            <div className="rule" />
            <h4 className="lbl">{t("specialtiesLabel")}</h4>
            <p>{profile.specialties.map((s) => s.nameEn).join(", ")}</p>
          </>
        )}

        <div className="rule" />
        <h4 className="lbl">{t("ratingLabel")}</h4>
        {summary.averageRating === null ? (
          <p style={{ color: "var(--color-ink-soft)" }}>{t("noReviewsYet")}</p>
        ) : (
          <div className="rating-summary">
            <b>{summary.averageRating.toFixed(1)}</b>
            <StarRating rating={summary.averageRating} />
            <span className="mono text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {t("reviewCount", { count: summary.reviewCount })}
            </span>
          </div>
        )}
      </div>

      <h2 className="lbl mt-6" style={{ color: "var(--color-cream-dim)" }}>
        {t("clinicsLabel")}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {profile.clinics.map((clinic) => (
          <li key={clinic.id} className="card">
            <b className="disp text-sm font-semibold">{clinic.name}</b>
            <p className="mt-1 text-sm" style={{ color: "#6b7b73" }}>
              {clinic.address}
            </p>
            <p className="text-sm" style={{ color: "#6b7b73" }}>
              {clinic.area}, {clinic.city}
            </p>
            <p className="fee mono mt-2" style={{ marginLeft: 0 }}>
              {clinic.consultationFee}
            </p>
            <Link
              href={`/patient/book/${profile.slug}/${clinic.slug}`}
              locale={locale}
              className="mt-3 inline-block"
            >
              <span className="btn sm">{t("bookAt")}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="lbl mt-6" style={{ color: "var(--color-cream-dim)" }}>
        {t("reviewsLabel")}
      </h2>

      {reviews.length > 0 && (
        <div className="card mt-3">
          {reviews.map((review) => (
            <div key={review.id} className="review">
              <div className="flex items-center justify-between gap-3">
                <StarRating rating={review.rating} />
                <span className="mono text-xs" style={{ color: "#8a9a92" }}>
                  {formatClinicDate(review.createdAt, locale)}
                </span>
              </div>
              {review.comment && <p>{review.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <div id="review-form" className="slip mt-4">
        <h4 className="lbl">{t("leaveReviewLabel")}</h4>
        {user ? (
          <form action={action} className="flex flex-col gap-4">
            <label>
              <span className="lbl">{t("ratingLabel")}</span>
              <select name="rating" required defaultValue="5" className="field tap-target">
                <option value="5">★★★★★ (5)</option>
                <option value="4">★★★★☆ (4)</option>
                <option value="3">★★★☆☆ (3)</option>
                <option value="2">★★☆☆☆ (2)</option>
                <option value="1">★☆☆☆☆ (1)</option>
              </select>
            </label>
            <label>
              <span className="lbl">{t("commentLabel")}</span>
              <textarea name="comment" rows={3} className="field" />
            </label>
            <button type="submit" className="btn tap-target self-start">
              {t("submitReview")}
            </button>
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {t("reviewEligibilityNote")}
            </p>
          </form>
        ) : (
          <p style={{ color: "var(--color-ink-soft)" }}>
            <Link href="/login" locale={locale} style={{ color: "var(--color-stamp)" }}>
              {t("loginToReview")}
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
