import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listMyAppointments, listMyWaitlist } from "@/lib/api/booking";
import { listFamilyMembers } from "@/lib/api/patients";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format-time";
import {
  cancelAppointmentAction,
  leaveWaitlistAction,
  rescheduleAppointmentAction,
} from "../../actions";

const REVIEWABLE_STATUSES = ["checked_in", "completed"];
const ACTIVE_WAITLIST_STATUSES = ["waiting", "offered"];

export default async function AppointmentsPage(
  props: PageProps<"/[locale]/patient/appointments">,
) {
  const { locale } = await props.params;
  const [t, appointments, waitlistEntries, familyMembers] = await Promise.all([
    getTranslations("patient"),
    listMyAppointments(),
    listMyWaitlist(),
    listFamilyMembers(),
  ]);
  const familyMemberNameById = new Map(familyMembers.map((m) => [m.id, m.fullName]));
  const rescheduleAction = rescheduleAppointmentAction.bind(null, locale);
  const cancelAction = cancelAppointmentAction.bind(null, locale);
  const leaveWaitlist = leaveWaitlistAction.bind(null, locale);
  const activeWaitlistEntries = waitlistEntries.filter((e) =>
    ACTIVE_WAITLIST_STATUSES.includes(e.status),
  );

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

      {activeWaitlistEntries.length > 0 && (
        <>
          <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
            {t("myWaitlistHeading")}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeWaitlistEntries.map((entry) => (
              <li key={entry.id} className="vslip">
                <div className="vhead">
                  <b>{formatClinicDate(entry.requestedDate, locale)}</b>
                  <span className={`vtag vd ${entry.status === "offered" ? "dr" : ""}`}>
                    {t(`waitlistStatus.${entry.status}` as "waitlistStatus.waiting")}
                  </span>
                </div>
                <small className="mt-1 block">{entry.practitionerFullName}</small>
                <small className="mono mt-1 block" style={{ color: "#7a8a82" }}>
                  {entry.clinicName}
                </small>
                <small className="mono mt-1 block" style={{ color: "#7a8a82" }}>
                  {entry.subjectType === "family_member"
                    ? (entry.familyMemberId && familyMemberNameById.get(entry.familyMemberId)) ??
                      t("forFamilyMember")
                    : t("forSelf")}
                </small>
                <form action={leaveWaitlist} className="mt-3">
                  <input type="hidden" name="waitlistEntryId" value={entry.id} />
                  <button type="submit" className="btn gh sm tap-target">
                    {t("leaveWaitlist")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
