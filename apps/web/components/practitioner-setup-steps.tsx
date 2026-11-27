import { useTranslations } from "next-intl";
import { Stepper } from "@/components/ui/stepper";

/**
 * Where a new doctor is in getting listed: they chose "healthcare provider",
 * then register their practice, set working hours, and get verified. Shown
 * on each of those pages until that step is done.
 */
export function PractitionerSetupSteps({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("onboarding");
  return (
    <div className="mb-6">
      <Stepper
        label={t("setupStepsLabel")}
        current={current}
        steps={[t("setupStepRole"), t("setupStepPractice"), t("setupStepHours"), t("setupStepVerification")]}
      />
    </div>
  );
}
