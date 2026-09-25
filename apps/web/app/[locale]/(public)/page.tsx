import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchPractitioners } from "@/lib/api/directory";
import { StarRating } from "@/components/star-rating";

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
    <main className="w-full flex-1">
      <section className="hero px-4 md:px-10 lg:px-16">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="kicker-row">
              <div className="seal">
                <em>{t("sealLine1")}</em>
                <em>{t("sealLine2")}</em>
              </div>
              <p className="kicker">{t("heading")}</p>
            </div>
            <h1 className="disp mt-4 text-[clamp(1.6rem,4.8vw,4rem)] leading-[1.08] font-extrabold tracking-tight text-paper">
              {/* No whitespace-nowrap: at the clamp's floor size, the Urdu
                  headline especially can still be wider than a narrow phone
                  screen (~320-360px) — letting a `block` line wrap onto a
                  second visual line beats clipping it off-screen. */}
              <span className="block">{t("heroHeadlineLine1")}</span>
              <span className="block">{t("heroHeadlineLine2")}</span>
            </h1>
            <p
              className="mt-5 max-w-xl text-base md:text-lg"
              style={{ color: "var(--color-cream-dim)" }}
            >
              {t("heroSubtitle")}
            </p>

            <div className="hero-stats">
              <div className="hero-stat">
                <b>{total}</b>
                <em>{t("resultCount", { count: total })}</em>
              </div>
              {verifiedCount > 0 && (
                <div className="hero-stat">
                  <b>{verifiedCount}</b>
                  <em>{t("verifiedBadge")}</em>
                </div>
              )}
              {clinicCount > 0 && (
                <div className="hero-stat">
                  <b>{clinicCount}</b>
                  <em>{city}</em>
                </div>
              )}
              {specialtyList.length > 0 && (
                <div className="hero-stat">
                  <b>{specialtyList.length}</b>
                  <em>{t("specialtiesLabel")}</em>
                </div>
              )}
            </div>
          </div>

          <form method="get" className="slip hero-search flex flex-wrap items-end gap-3">
            <label className="flex-1" style={{ minWidth: 160 }}>
              <span className="lbl">{t("cityLabel")}</span>
              <input type="text" name="city" defaultValue={city} className="field tap-target" />
            </label>
            <label className="flex-1" style={{ minWidth: 200 }}>
              <span className="lbl">{t("searchLabel")}</span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                className="field tap-target"
              />
            </label>
            {/* Not a visible field — carries the active specialty chip
                through a name/city search submit, which otherwise only
                posts city+q and would silently drop it. */}
            {specialty && <input type="hidden" name="specialty" value={specialty} />}
            <div className="rowend" style={{ minWidth: 140 }}>
              <button type="submit" className="btn tap-target">
                {t("heading")}
              </button>
            </div>

            {specialtyList.length > 0 && (
              <div className="mt-1 flex w-full flex-wrap gap-2">
                {specialtyList.slice(0, 8).map((s) => (
                  <Link
                    key={s.id}
                    href={{
                      pathname: "/",
                      query: q ? { city, q, specialty: s.slug } : { city, specialty: s.slug },
                    }}
                    locale={locale}
                    className={`chip${specialty === s.slug ? " on" : ""}`}
                  >
                    {s.nameEn}
                  </Link>
                ))}
              </div>
            )}
          </form>
        </div>
      </section>

      <section
        className="px-4 md:px-10 lg:px-16"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <div className="trust-strip">
          <div className="trust-item">
            <span className="trust-mark" style={{ color: "var(--color-mint)" }}>
              ✓
            </span>
            <div>
              <h3>{t("trust1Title")}</h3>
              <p>{t("trust1Body")}</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-mark" style={{ color: "var(--color-brass)" }}>
              ◷
            </span>
            <div>
              <h3>{t("trust2Title")}</h3>
              <p>{t("trust2Body")}</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-mark" style={{ color: "var(--color-seal)" }}>
              ⚕
            </span>
            <div>
              <h3>{t("trust3Title")}</h3>
              <p>{t("trust3Body")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-4 py-10 md:px-10 lg:px-16" style={{ borderTop: "1px solid var(--color-line)" }}>
        <div className="results-heading">
          <h2 className="disp text-xl font-bold text-paper md:text-2xl">
            {t("resultsHeading")}
          </h2>
          <p className="mono text-xs" style={{ color: "var(--color-cream-dim)" }}>
            {t("resultCount", { count: total })}
          </p>
        </div>

        {results.length === 0 ? (
          <p className="mt-8" style={{ color: "var(--color-cream-dim)" }}>
            {t("empty")}
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {results.map((listing) => (
              <li key={`${listing.practitionerId}-${listing.clinic.id}`}>
                <Link
                  href={`/practitioners/${listing.practitionerSlug}`}
                  locale={locale}
                  className="block h-full"
                >
                  <div className="dcard h-full">
                    <div className="av">
                      {listing.fullName
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <b>{listing.fullName}</b>
                      <small>{listing.specialties.map((s) => s.nameEn).join(", ")}</small>
                      <small>
                        {listing.clinic.name} — {listing.clinic.area}, {listing.clinic.city}
                      </small>
                      {listing.verificationStatus === "verified" && (
                        <span className="vtick">{t("verifiedBadge")}</span>
                      )}
                      {listing.averageRating !== null && (
                        <span className="mt-1 flex items-center gap-1">
                          <StarRating rating={listing.averageRating} />
                          <span className="mono text-xs" style={{ color: "#8a9a92" }}>
                            {listing.averageRating.toFixed(1)} ({listing.reviewCount})
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="fee mono">
                      {listing.consultationFee}
                      <em>{t("feeLabel")}</em>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
