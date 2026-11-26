import { PRACTITIONER_TYPE } from "@careconnect/shared-types";
import { Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listSpecialties } from "@/lib/api/practitioners";
import { getMe } from "@/lib/api/me";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormField } from "@/components/ui/form-field";
import { registerPractitionerAction } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { localizedName } from "@/i18n/routing";

const GENDERS = ["male", "female", "other"] as const;

const inputClasses =
  "tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600";

export default async function PractitionerOnboardingPage(
  props: PageProps<"/[locale]/onboarding/practitioner">,
) {
  const { locale } = await props.params;
  const { error } = await props.searchParams;
  const [t, me, specialties] = await Promise.all([
    getTranslations("onboarding"),
    getMe(),
    // Not filtered by practitioner type here — that choice lives inside
    // this same form, and narrowing the list would need client-side
    // interactivity this v1 doesn't have yet. Showing the full list is a
    // minor rough edge, not a blocker: it's still self-tagging, not a hard
    // constraint enforced anywhere downstream.
    listSpecialties(),
  ]);
  const action = registerPractitionerAction.bind(null, locale);
  const alreadyRegistered = !!me.practitioner;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
      <Card padding="lg">
        <PageHeader icon={Stethoscope} title={t("practitionerHeading")} />

        <form action={action} className="flex flex-col gap-4">
          {error && (
            <Alert
              tone="danger"
              title={error === "specialties" ? t("specialtiesRequired") : t("error")}
            />
          )}

          {!alreadyRegistered && (
            <>
              <FormField label={t("fullNameLabel")}>
                <input type="text" name="fullName" required className={inputClasses} />
              </FormField>

              <FormField label={t("genderLabel")}>
                <select name="gender" required className={inputClasses}>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {t(`genders.${g}`)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={t("practitionerTypeLabel")}>
                <select name="practitionerType" required className={inputClasses}>
                  {PRACTITIONER_TYPE.map((type) => (
                    <option key={type} value={type}>
                      {t(`practitionerTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={t("councilRegistrationNoLabel")}>
                <input type="text" name="councilRegistrationNo" required className={inputClasses} />
              </FormField>

              <FormField label={t("bioLabel")}>
                <textarea name="bio" rows={3} className={inputClasses} />
              </FormField>

              <FormField label={t("languagesLabel")}>
                <input
                  type="text"
                  name="languages"
                  required
                  placeholder={t("languagesPlaceholder")}
                  className={inputClasses}
                />
              </FormField>

              <FormField label={t("specialtiesLabel")} hint={t("specialtiesHint")}>
                <div className="mt-2 flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-text transition has-checked:border-primary-600 has-checked:bg-primary-50 has-checked:text-primary-800"
                    >
                      <input type="checkbox" name="specialtyIds" value={s.id} className="accent-primary-600" />
                      {localizedName(s, locale)}
                    </label>
                  ))}
                </div>
              </FormField>

              <div className="border-t border-border" />
            </>
          )}

          <h2 className="text-base font-bold text-text">
            {t("clinicSectionHeading")}
          </h2>

          <FormField label={t("clinicNameLabel")}>
            <input type="text" name="clinicName" required className={inputClasses} />
          </FormField>

          <FormField label={t("clinicCityLabel")}>
            <input type="text" name="clinicCity" required className={inputClasses} />
          </FormField>

          <FormField label={t("clinicAreaLabel")}>
            <input type="text" name="clinicArea" required className={inputClasses} />
          </FormField>

          <FormField label={t("clinicAddressLabel")}>
            <input type="text" name="clinicAddress" required className={inputClasses} />
          </FormField>

          <FormField label={t("clinicPhoneLabel")}>
            <input
              type="tel"
              name="clinicPhone"
              placeholder="+923001234567"
              className={inputClasses}
            />
          </FormField>

          <SubmitButton
            className="tap-target rounded-md bg-primary-700 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
          >
            {t("submit")}
          </SubmitButton>
        </form>
      </Card>
    </main>
  );
}
