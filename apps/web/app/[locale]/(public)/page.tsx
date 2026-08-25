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

  const t = await getTranslations("directory");
  const { results, total } = await searchPractitioners({ city, q, page: 1, pageSize: 20 });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <p className="kicker">{t("heading")}</p>
      <h1 className="disp mt-2 text-3xl font-extrabold tracking-tight text-paper">
        {t("heading")}
      </h1>

      <form method="get" className="slip mt-6 flex flex-wrap items-end gap-3">
        <label className="flex-1" style={{ minWidth: 140 }}>
          <span className="lbl">{t("cityLabel")}</span>
          <input type="text" name="city" defaultValue={city} className="field tap-target" />
        </label>
        <label className="flex-1" style={{ minWidth: 180 }}>
          <span className="lbl">{t("searchLabel")}</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            className="field tap-target"
          />
        </label>
        <button type="submit" className="btn tap-target">
          {t("heading")}
        </button>
      </form>

      <p className="mono mt-5 text-xs" style={{ color: "var(--color-cream-dim)" }}>
        {t("resultCount", { count: total })}
      </p>

      {results.length === 0 ? (
        <p className="mt-8" style={{ color: "var(--color-cream-dim)" }}>
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {results.map((listing) => (
            <li key={`${listing.practitionerId}-${listing.clinic.id}`}>
              <Link href={`/practitioners/${listing.practitionerSlug}`} locale={locale} className="block">
                <div className="dcard">
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
    </main>
  );
}
