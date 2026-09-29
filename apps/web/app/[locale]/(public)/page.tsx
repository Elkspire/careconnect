import { CheckCircle2, Clock3, MapPin, Search, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchPractitioners } from "@/lib/api/directory";
import { StarRating } from "@/components/star-rating";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatGrid } from "@/components/ui/stat-tile";
import { InitialsAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

const DEFAULT_CITY = "Lahore";

export default async function DirectoryPage(props: PageProps<"/[locale]">) {
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

  const clinicCount = new Set(results.map((r) => r.clinic.id)).size;
  // Keyed by slug, not name — the chips below link by the specialty's slug
  // (a human-readable exact filter the API applies via
  // practitionerSpecialties), so a clicked chip has to carry the same slug
  // it was built from.
  const specialtiesBySlug = new Map(
    results.flatMap((r) => r.specialties).map((s) => [s.slug, s]),
  );
  const specialtyList = [...specialtiesBySlug.values()];
  const verifiedCount = results.filter((r) => r.verificationStatus === "verified").length;

  return (
    <main className="w-full flex-1 bg-bg">
      <section className="bg-gradient-to-br from-primary-700 to-accent-700 px-4 py-12 text-text-on-primary sm:px-8 md:py-16 lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[clamp(1.8rem,4.8vw,3rem)] font-extrabold leading-tight text-balance">
              <span className="block">{t("heroHeadlineLine1")}</span>
              <span className="block">{t("heroHeadlineLine2")}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-primary-100 md:text-lg">{t("heroSubtitle")}</p>

            <StatGrid>
              <div className="rounded-md bg-white/10 px-4 py-3">
                <div className="text-2xl font-extrabold">{total}</div>
                <div className="text-xs font-medium text-primary-100">
                  {t("resultCount", { count: total })}
                </div>
              </div>
              {verifiedCount > 0 && (
                <div className="rounded-md bg-white/10 px-4 py-3">
                  <div className="text-2xl font-extrabold">{verifiedCount}</div>
                  <div className="text-xs font-medium text-primary-100">{t("verifiedBadge")}</div>
                </div>
              )}
              {clinicCount > 0 && (
                <div className="rounded-md bg-white/10 px-4 py-3">
                  <div className="text-2xl font-extrabold">{clinicCount}</div>
                  <div className="text-xs font-medium text-primary-100">{city}</div>
                </div>
              )}
              {specialtyList.length > 0 && (
                <div className="rounded-md bg-white/10 px-4 py-3">
                  <div className="text-2xl font-extrabold">{specialtyList.length}</div>
                  <div className="text-xs font-medium text-primary-100">{t("specialtiesLabel")}</div>
                </div>
              )}
            </StatGrid>
          </div>

          <Card padding="lg" className="w-full max-w-md shrink-0">
            <form method="get" className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t("cityLabel")}
                </span>
                <div className="relative">
                  <MapPin aria-hidden className="absolute inset-y-0 start-3 my-auto size-4 text-text-faint" />
                  <input
                    type="text"
                    name="city"
                    defaultValue={city}
                    className="tap-target w-full rounded-md border border-border py-2 ps-9 pe-3 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t("searchLabel")}
                </span>
                <div className="relative">
                  <Search aria-hidden className="absolute inset-y-0 start-3 my-auto size-4 text-text-faint" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder={t("searchPlaceholder")}
                    className="tap-target w-full rounded-md border border-border py-2 ps-9 pe-3 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </label>
              {/* Not a visible field — carries the active specialty chip
                  through a name/city search submit, which otherwise only
                  posts city+q and would silently drop it. */}
              {specialty && <input type="hidden" name="specialty" value={specialty} />}
              <button
                type="submit"
                className="tap-target flex items-center justify-center gap-2 rounded-md bg-primary-700 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
              >
                <Search aria-hidden className="size-4" />
                {t("heading")}
              </button>

              {specialtyList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specialtyList.slice(0, 8).map((s) => (
                    <Link
                      key={s.id}
                      href={{
                        pathname: "/",
                        query: q ? { city, q, specialty: s.slug } : { city, specialty: s.slug },
                      }}
                      locale={locale}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        specialty === s.slug
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-border text-text-muted hover:border-primary-500 hover:text-primary-700"
                      }`}
                    >
                      {s.nameEn}
                    </Link>
                  ))}
                </div>
              )}
            </form>
          </Card>
        </div>
      </section>

      <section className="border-b border-border bg-surface px-4 py-8 sm:px-8 lg:px-16">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden className="size-6 shrink-0 text-primary-600" />
            <div>
              <h3 className="font-semibold text-text">{t("trust1Title")}</h3>
              <p className="mt-0.5 text-sm text-text-muted">{t("trust1Body")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 aria-hidden className="size-6 shrink-0 text-accent-600" />
            <div>
              <h3 className="font-semibold text-text">{t("trust2Title")}</h3>
              <p className="mt-0.5 text-sm text-text-muted">{t("trust2Body")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Stethoscope aria-hidden className="size-6 shrink-0 text-purple-fg" />
            <div>
              <h3 className="font-semibold text-text">{t("trust3Title")}</h3>
              <p className="mt-0.5 text-sm text-text-muted">{t("trust3Body")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-8 lg:px-16">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-text md:text-2xl">{t("resultsHeading")}</h2>
          <p className="text-sm text-text-muted">{t("resultCount", { count: total })}</p>
        </div>

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
                          {listing.specialties.map((s) => s.nameEn).join(", ")}
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
      </section>
    </main>
  );
}
