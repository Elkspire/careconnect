import { CheckCircle2, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchPractitioners } from "@/lib/api/directory";
import { StarRating } from "@/components/star-rating";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { localizedName } from "@/i18n/routing";

const DEFAULT_CITY = "Lahore";

/** The reference's separate "Directory" screen (search + results) — split out of Home so Home stays a pure marketing entry point. */
export default async function DirectorySearchPage(
  props: PageProps<"/[locale]/directory">,
) {
  const { locale } = await props.params;
  const sp = await props.searchParams;
  const city = typeof sp.city === "string" && sp.city ? sp.city : DEFAULT_CITY;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const specialty = typeof sp.specialty === "string" ? sp.specialty : undefined;

  const t = await getTranslations("directory");
  const { results, total } = await searchPractitioners({
    city,
    q,
    specialty,
    page: 1,
    pageSize: 20,
  });

  // Keyed by slug, not name — the chips below link by the specialty's slug
  // (a human-readable exact filter the API applies via
  // practitionerSpecialties), so a clicked chip has to carry the same slug
  // it was built from.
  const specialtiesBySlug = new Map(
    results.flatMap((r) => r.specialties).map((s) => [s.slug, s]),
  );
  const specialtyList = [...specialtiesBySlug.values()];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
          <Search aria-hidden className="size-5 text-primary-600" />
          {t("heading")}
        </h1>
        <p className="text-sm text-text-muted">{t("resultCount", { count: total })}</p>
      </div>

      <Card padding="lg" className="mb-6">
        <form method="get" className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("cityLabel")}
            </span>
            <input
              type="text"
              name="city"
              defaultValue={city}
              className="tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("searchLabel")}
            </span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              className="tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          {/* Not a visible field — carries the active specialty chip
              through a name/city search submit, which otherwise only
              posts city+q and would silently drop it. */}
          {specialty && <input type="hidden" name="specialty" value={specialty} />}
          <button
            type="submit"
            className="tap-target flex items-center justify-center gap-2 self-end rounded-md bg-primary-700 px-5 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
          >
            <Search aria-hidden className="size-4" />
            {t("heading")}
          </button>
        </form>
      </Card>

      {specialtyList.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {specialtyList.slice(0, 8).map((s) => (
            <Link
              key={s.id}
              href={{
                pathname: "/directory",
                query: q ? { city, q, specialty: s.slug } : { city, specialty: s.slug },
              }}
              locale={locale}
              className={`tap-target inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                specialty === s.slug
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-border text-text-muted hover:border-primary-500 hover:text-primary-700"
              }`}
            >
              {localizedName(s, locale)}
            </Link>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState icon={Search} title={t("empty")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((listing) => (
            <li key={`${listing.practitionerId}-${listing.clinic.id}`}>
              <Link href={`/practitioners/${listing.practitionerSlug}`} locale={locale} className="block h-full">
                <Card interactive className="flex h-full flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={listing.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text">{listing.fullName}</p>
                      <p className="truncate text-sm font-medium text-primary-700">
                        {listing.specialties.map((s) => localizedName(s, locale)).join(", ")}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {listing.clinic.name} — {listing.clinic.area}, {listing.clinic.city}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {listing.verificationStatus === "verified" && (
                      <Badge tone="green" icon={CheckCircle2}>
                        {t("verifiedBadge")}
                      </Badge>
                    )}
                    {listing.averageRating !== null && (
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <StarRating rating={listing.averageRating} />
                        {listing.averageRating.toFixed(1)} ({listing.reviewCount})
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-baseline justify-end gap-1 border-t border-border pt-3">
                    <span className="font-bold text-text">{listing.consultationFee}</span>
                    <span className="text-xs text-text-muted">{t("feeLabel")}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
