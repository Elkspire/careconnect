import { CheckCircle2, Clock3, Search, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchPractitioners } from "@/lib/api/directory";
import { StarRating } from "@/components/star-rating";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

const DEFAULT_CITY = "Lahore";

export default async function DirectoryPage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  const sp = await props.searchParams;
  const city = typeof sp.city === "string" && sp.city ? sp.city : DEFAULT_CITY;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const specialty = typeof sp.specialty === "string" ? sp.specialty : undefined;

  const [t, tSite] = await Promise.all([getTranslations("directory"), getTranslations("site")]);
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
    <main className="w-full flex-1 bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 px-6 py-10 text-text-on-primary sm:px-10 sm:py-14">
          <div
            aria-hidden
            className="absolute -bottom-10 -end-10 size-52 rounded-full bg-white/10"
          />
          <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[clamp(1.8rem,4.8vw,2.8rem)] font-extrabold leading-tight text-balance">
                <span className="block">{t("heroHeadlineLine1")}</span>
                <span className="block">{t("heroHeadlineLine2")}</span>
              </h1>
              <p className="mt-3 max-w-md text-base text-primary-100">{t("heroSubtitle")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#search"
                  className="tap-target inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary-800 transition hover:bg-primary-50"
                >
                  <Search aria-hidden className="size-4" />
                  {t("heading")}
                </a>
                <Link
                  href="/login"
                  locale={locale}
                  className="tap-target inline-flex items-center gap-2 rounded-md border-2 border-white/50 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
                >
                  {tSite("login")}
                </Link>
              </div>
            </div>
            <Stethoscope aria-hidden className="hidden size-32 shrink-0 opacity-15 md:block" />
          </div>
        </section>

        {/* Features */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: t("trust1Title"),
              body: t("trust1Body"),
              icon: CheckCircle2,
              bg: "bg-primary-100",
              fg: "text-primary-600",
            },
            {
              title: t("trust2Title"),
              body: t("trust2Body"),
              icon: Clock3,
              bg: "bg-accent-100",
              fg: "text-accent-600",
            },
            {
              title: t("trust3Title"),
              body: t("trust3Body"),
              icon: Stethoscope,
              bg: "bg-purple-bg",
              fg: "text-purple-fg",
            },
          ].map((feature) => (
            <Card key={feature.title} interactive>
              <div className={`flex size-11 items-center justify-center rounded-lg ${feature.bg}`}>
                <feature.icon aria-hidden className={`size-5 ${feature.fg}`} />
              </div>
              <h3 className="mt-3 font-semibold text-text">{feature.title}</h3>
              <p className="mt-1 text-sm text-text-muted">{feature.body}</p>
            </Card>
          ))}
        </section>

        {/* Popular specialties */}
        {specialtyList.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-text">{t("specialtiesLabel")}</h2>
            <div className="flex flex-wrap gap-2">
              {specialtyList.slice(0, 8).map((s) => (
                <Link
                  key={s.id}
                  href={{
                    pathname: "/",
                    query: q ? { city, q, specialty: s.slug } : { city, specialty: s.slug },
                  }}
                  locale={locale}
                  className={`tap-target inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition ${
                    specialty === s.slug
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-border bg-surface text-text hover:border-primary-500 hover:text-primary-700"
                  }`}
                >
                  <Stethoscope aria-hidden className="size-4" />
                  {s.nameEn}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search + results */}
        <section id="search" className="mt-10 scroll-mt-20">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-text md:text-2xl">{t("resultsHeading")}</h2>
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
      </div>
    </main>
  );
}
