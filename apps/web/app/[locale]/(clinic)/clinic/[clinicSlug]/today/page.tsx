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
  const checkedInCount = appointments.filter((a) => a.status === "checked_in").length;
  const waitingCount = appointments.length - checkedInCount;

  return (
    <div className="max-w-5xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        {staffCtx.clinicName}
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("todayHeading")}</h1>

      <div className="stats mt-6">
        <div className="stat">
          <b>{appointments.length}</b>
          <em>{t("todayHeading")}</em>
        </div>
        <div className="stat">
          <b>{checkedInCount}</b>
          <em>{t("checkedIn")}</em>
        </div>
        <div className="stat">
          <b>{waitingCount}</b>
          <em>{t("checkIn")}</em>
        </div>
      </div>

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
    </div>
  );
}
