import { Stethoscope, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { RoleCard } from "@/components/ui/role-card";

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
      <h1 className="text-center text-xl font-bold text-text">{t("roleHeading")}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <RoleCard
          href="/patient"
          locale={locale as AppLocale}
          icon={UserRound}
          title={t("patientOption")}
          description={t("patientOptionDesc")}
        />
        <RoleCard
          href="/onboarding/practitioner"
          locale={locale as AppLocale}
          icon={Stethoscope}
          title={t("practitionerOption")}
          description={t("practitionerOptionDesc")}
        />
      </div>
    </main>
  );
}
