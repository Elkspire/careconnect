import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listToday } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicTime } from "@/lib/format-time";
import { checkInAction } from "../../../actions";

export default async function ClinicTodayPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/today">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }
  const clinicId = staffCtx.clinicId;

  const appointments = await listToday(clinicId);
  const action = checkInAction.bind(null, locale, clinicSlug, clinicId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <p className="kicker">CareConnect</p>
      <h1 className="disp mt-2 text-2xl font-bold text-paper">{t("todayHeading")}</h1>

      <div className="slip mt-6">
        {appointments.length === 0 ? (
          <p style={{ color: "var(--color-ink-soft)" }}>{t("noAppointmentsToday")}</p>
        ) : (
          appointments.map((appt, i) => (
            <div key={appt.appointmentId} className="qrow">
              <span className="qn mono">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <b>{appt.patientFullName}</b>
                <small>
                  {formatClinicTime(appt.scheduledStart, locale)} · {appt.patientPhone}
                </small>
              </div>
              {appt.status === "checked_in" ? (
                <span className="qs in">{t("checkedIn")}</span>
              ) : (
                <form action={action}>
                  <input type="hidden" name="appointmentId" value={appt.appointmentId} />
                  <button type="submit" className="qb tap-target">
                    {t("checkIn")}
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
