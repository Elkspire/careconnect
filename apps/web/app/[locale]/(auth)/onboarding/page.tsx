import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * Every new sign-in used to land straight on /patient regardless of who
 * they actually were — a doctor signing up had no way to say so, and just
 * became a patient by default. This is the missing fork: shown once, right
 * after login, before either a patients or practitioners row exists (see
 * post-login/page.tsx's redirect logic).
 */
export default async function OnboardingPage(
  props: PageProps<"/[locale]/onboarding">,
) {
  const { locale } = await props.params;
  const t = await getTranslations("onboarding");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
      <div className="slip">
        <p className="slip-no mono">CC / ONBOARD-01</p>
        <h1>{t("roleHeading")}</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <RoleCard
            href="/patient"
            locale={locale as AppLocale}
            title={t("patientOption")}
            body={t("patientOptionDesc")}
          />
          <RoleCard
            href="/onboarding/practitioner"
            locale={locale as AppLocale}
            title={t("practitionerOption")}
            body={t("practitionerOptionDesc")}
          />
        </div>
      </div>
    </main>
  );
}

function RoleCard({
  href,
  locale,
  title,
  body,
}: {
  href: "/patient" | "/onboarding/practitioner";
  locale: AppLocale;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} locale={locale} className="card tap-target">
      <b className="disp block text-base font-semibold">{title}</b>
      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {body}
      </p>
    </Link>
  );
}
