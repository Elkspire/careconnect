import { Stethoscope, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleCard } from "@/components/ui/role-card";

/**
 * Every new sign-in used to land straight on /patient regardless of who
 * they actually were — a doctor signing up had no way to say so, and just
 * became a patient by default. This is the missing fork: shown once, right
 * after login, before either a patients or practitioners row exists (see
 * post-login/page.tsx's redirect logic).
 */
export default async function OnboardingPage() {
  const t = await getTranslations("onboarding");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
      <h1 className="text-center text-[22px] font-bold text-text">{t("roleHeading")}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <RoleCard
          href="/patient"
          icon={UserRound}
          title={t("patientOption")}
          description={t("patientOptionDesc")}
        />
        <RoleCard
          href="/onboarding/practitioner"
          icon={Stethoscope}
          title={t("practitionerOption")}
          description={t("practitionerOptionDesc")}
        />
      </div>

      <p className="mt-6 text-center text-sm text-text-muted">{t("staffNote")}</p>
    </main>
  );
}
