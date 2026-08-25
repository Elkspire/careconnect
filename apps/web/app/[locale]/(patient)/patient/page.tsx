import { getTranslations } from "next-intl/server";
import { getMyProfile } from "@/lib/api/patients";
import { PushNotifications } from "@/components/push-notifications";
import { saveProfileAction } from "../actions";

export default async function PatientDashboardPage(props: PageProps<"/[locale]/patient">) {
  const { locale } = await props.params;
  const [t, profile] = await Promise.all([getTranslations("patient"), getMyProfile()]);
  const action = saveProfileAction.bind(null, locale);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <p className="kicker">CareConnect</p>
      <h1 className="disp mt-2 text-2xl font-bold text-paper">{t("dashboardHeading")}</h1>

      <div className="slip mt-6">
        {!profile && (
          <div className="alert mb-5">
            <div>
              <b>{t("createProfilePrompt")}</b>
            </div>
          </div>
        )}

        <form action={action} className="flex flex-col gap-4">
          <label>
            <span className="lbl">{t("fullNameLabel")}</span>
            <input
              type="text"
              name="fullName"
              required
              defaultValue={profile?.fullName}
              className="field tap-target"
            />
          </label>
          <label>
            <span className="lbl">{t("preferredLanguageLabel")}</span>
            <select
              name="preferredLanguage"
              defaultValue={profile?.preferredLanguage ?? locale}
              className="field tap-target"
            >
              <option value="en">English</option>
              <option value="ur">اردو</option>
            </select>
          </label>
          <button type="submit" className="btn tap-target self-start">
            {t("saveProfile")}
          </button>
        </form>
      </div>

      <div className="slip mt-6">
        <h4 className="lbl">{t("preferencesHeading")}</h4>
        <PushNotifications />
      </div>
    </main>
  );
}
