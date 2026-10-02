import { CheckCircle2, Clock3, Search, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listSpecialties } from "@/lib/api/practitioners";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  const [t, tSite, specialties, supabase] = await Promise.all([
    getTranslations("directory"),
    getTranslations("site"),
    listSpecialties(),
    createClient(),
  ]);
  // Mirrors SiteHeader's login/"My Account" check — the hero's second CTA
  // had never looked at auth state, so it kept inviting an already-signed-in
  // visitor to log in again instead of taking them to their dashboard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
                <Link
                  href="/directory"
                  locale={locale}
                  className="tap-target inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary-800 transition hover:bg-primary-50"
                >
                  <Search aria-hidden className="size-4" />
                  {t("heading")}
                </Link>
                <Link
                  href={user ? "/post-login" : "/login"}
                  locale={locale}
                  className="tap-target inline-flex items-center gap-2 rounded-md border-2 border-white/50 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
                >
                  {user ? tSite("myAccount") : tSite("login")}
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

        {/* Popular specialties — browse entry point into /directory, not
            scoped to any one city's current results (unlike the chips on
            the directory page itself, which only show specialties present
            in the active search). */}
        {specialties.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-text">{t("specialtiesLabel")}</h2>
            <div className="flex flex-wrap gap-2">
              {specialties.slice(0, 8).map((s) => (
                <Link
                  key={s.id}
                  href={{ pathname: "/directory", query: { specialty: s.slug } }}
                  locale={locale}
                  className="tap-target inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
                >
                  <Stethoscope aria-hidden className="size-4" />
                  {s.nameEn}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
