import { PRACTITIONER_TYPE } from "@careconnect/shared-types";
import { getTranslations } from "next-intl/server";
import { listSpecialties } from "@/lib/api/practitioners";
import { getMe } from "@/lib/api/me";
import { registerPractitionerAction } from "../actions";

const GENDERS = ["male", "female", "other"] as const;

export default async function PractitionerOnboardingPage(
  props: PageProps<"/[locale]/onboarding/practitioner">,
) {
  const { locale } = await props.params;
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
      <div className="slip">
        <p className="slip-no mono">CC / ONBOARD-02</p>
        <h1>{t("practitionerHeading")}</h1>

        <form action={action} className="mt-6 flex flex-col gap-4">
          {!alreadyRegistered && (
            <>
              <label>
                <span className="lbl">{t("fullNameLabel")}</span>
                <input
                  type="text"
                  name="fullName"
                  required
                  className="field tap-target"
                />
              </label>

              <label>
                <span className="lbl">{t("genderLabel")}</span>
                <select name="gender" required className="field tap-target">
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {t(`genders.${g}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="lbl">{t("practitionerTypeLabel")}</span>
                <select
                  name="practitionerType"
                  required
                  className="field tap-target"
                >
                  {PRACTITIONER_TYPE.map((type) => (
                    <option key={type} value={type}>
                      {t(`practitionerTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="lbl">{t("councilRegistrationNoLabel")}</span>
                <input
                  type="text"
                  name="councilRegistrationNo"
                  required
                  className="field tap-target"
                />
              </label>

              <label>
                <span className="lbl">{t("bioLabel")}</span>
                <textarea name="bio" rows={3} className="field" />
              </label>

              <label>
                <span className="lbl">{t("languagesLabel")}</span>
                <input
                  type="text"
                  name="languages"
                  required
                  placeholder={t("languagesPlaceholder")}
                  className="field tap-target"
                />
              </label>

              <div>
                <span className="lbl">{t("specialtiesLabel")}</span>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  {t("specialtiesHint")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <label key={s.id} className="chip flex items-center gap-2">
                      <input type="checkbox" name="specialtyIds" value={s.id} />
                      {s.nameEn}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rule" />
            </>
          )}

          <h2 className="lbl">{t("clinicSectionHeading")}</h2>

          <label>
            <span className="lbl">{t("clinicNameLabel")}</span>
            <input
              type="text"
              name="clinicName"
              required
              className="field tap-target"
            />
          </label>

          <label>
            <span className="lbl">{t("clinicCityLabel")}</span>
            <input
              type="text"
              name="clinicCity"
              required
              className="field tap-target"
            />
          </label>

          <label>
            <span className="lbl">{t("clinicAreaLabel")}</span>
            <input
              type="text"
              name="clinicArea"
              required
              className="field tap-target"
            />
          </label>

          <label>
            <span className="lbl">{t("clinicAddressLabel")}</span>
            <input
              type="text"
              name="clinicAddress"
              required
              className="field tap-target"
            />
          </label>

          <label>
            <span className="lbl">{t("clinicPhoneLabel")}</span>
            <input
              type="tel"
              name="clinicPhone"
              placeholder="+923001234567"
              className="field tap-target"
            />
          </label>

          <button type="submit" className="btn tap-target">
            {t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
