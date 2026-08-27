import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listMyAppointments } from "@/lib/api/booking";
import { listFamilyMembers } from "@/lib/api/patients";
import { formatClinicDateTime } from "@/lib/format-time";
import { cancelAppointmentAction, rescheduleAppointmentAction } from "../../actions";

const REVIEWABLE_STATUSES = ["checked_in", "completed"];

export default async function AppointmentsPage(
  props: PageProps<"/[locale]/patient/appointments">,
) {
  const { locale } = await props.params;
  const [t, appointments, familyMembers] = await Promise.all([
    getTranslations("patient"),
    listMyAppointments(),
    listFamilyMembers(),
  ]);
  const familyMemberNameById = new Map(familyMembers.map((m) => [m.id, m.fullName]));
  const rescheduleAction = rescheduleAppointmentAction.bind(null, locale);
  const cancelAction = cancelAppointmentAction.bind(null, locale);

  return (
    <div className="max-w-6xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("appointmentsHeading")}</h1>

      {appointments.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("noAppointments")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {appointments.map((appt) => (
            <li key={appt.id} className="vslip">
              <div className="vhead">
                <b>{formatClinicDateTime(appt.scheduledStart, locale)}</b>
                <span
                  className={`vtag vd ${appt.status === "cancelled" || appt.status === "no_show" ? "cancelled" : "dr"}`}
                >
                  {t(`status.${appt.status}` as "status.booked")}
                </span>
              </div>
              <small className="mt-1 block">{appt.practitionerFullName}</small>
              <small className="mono mt-1 block" style={{ color: "#7a8a82" }}>
                {appt.subjectType === "family_member"
                  ? (appt.familyMemberId && familyMemberNameById.get(appt.familyMemberId)) ??
                    t("forFamilyMember")
                  : t("forSelf")}
              </small>

              {REVIEWABLE_STATUSES.includes(appt.status) && (
                <Link
                  href={`/practitioners/${appt.practitionerSlug}#review-form`}
                  locale={locale}
                  className="mt-3 inline-block"
                >
                  <span className="btn gh sm">{t("leaveReview")}</span>
                </Link>
              )}

              {appt.status === "booked" && (
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <form action={rescheduleAction} className="flex items-end gap-2">
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <label>
                      <span className="lbl">{t("newTimeLabelPkt")}</span>
                      <input
                        type="datetime-local"
                        name="scheduledStart"
                        required
                        className="field tap-target"
                        style={{ fontSize: 13, padding: "8px 10px" }}
                      />
                    </label>
                    <button type="submit" className="btn gh sm tap-target">
                      {t("reschedule")}
                    </button>
                  </form>

                  <form action={cancelAction}>
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <button type="submit" className="btn gh sm tap-target">
                      {t("cancel")}
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
