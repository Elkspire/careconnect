import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listAppointmentsForAttach, listClinicWaitlist, listToday } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate, formatClinicTime } from "@/lib/format-time";
import { attachRecordAction, checkInAction, recordVitalsAction } from "../../../actions";

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
  // Check-in is a front-desk action (owner/receptionist per the product
  // doc's role matrix) — a junior doctor sees today's queue for context but
  // doesn't run it.
  const canCheckIn = staffCtx.role === "owner" || staffCtx.role === "receptionist";
  // Vitals are the assistant's actual job (journeys.html's Assistant
  // track) — recorded after check-in, before the doctor's consultation.
  const canRecordVitals = staffCtx.role === "owner" || staffCtx.role === "assistant";
  // Same role set today as canRecordVitals, but a distinct permission
  // (attachRecords) — kept as its own check since they could diverge.
  const canAttachRecords = staffCtx.role === "owner" || staffCtx.role === "assistant";

  const [appointments, waitlist, attachableAppointments] = await Promise.all([
    listToday(clinicId),
    listClinicWaitlist(clinicId),
    canAttachRecords ? listAppointmentsForAttach(clinicId) : Promise.resolve([]),
  ]);
  const action = checkInAction.bind(null, locale, clinicSlug, clinicId);
  const vitalsAction = recordVitalsAction.bind(null, locale, clinicSlug, clinicId);
  const attachAction = attachRecordAction.bind(null, locale, clinicSlug, clinicId);
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
            <div key={appt.appointmentId}>
              <div className="qrow">
                <span className="qn mono">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <b>{appt.patientFullName}</b>
                  <small>
                    {formatClinicTime(appt.scheduledStart, locale)} · {appt.patientPhone}
                  </small>
                </div>
                {appt.status === "checked_in" ? (
                  <span className="qs in">{t("checkedIn")}</span>
                ) : canCheckIn ? (
                  <form action={action}>
                    <input type="hidden" name="appointmentId" value={appt.appointmentId} />
                    <button type="submit" className="qb tap-target">
                      {t("checkIn")}
                    </button>
                  </form>
                ) : (
                  <span className="qs">{t("notCheckedIn")}</span>
                )}
              </div>
              {appt.status === "checked_in" && canRecordVitals && (
                <details className="ms-8 mt-1">
                  <summary
                    className="tap-target"
                    style={{ cursor: "pointer", color: "var(--color-ink-soft)" }}
                  >
                    {t("recordVitals")}
                  </summary>
                  <form
                    action={vitalsAction}
                    className="mt-2 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="appointmentId" value={appt.appointmentId} />
                    <label>
                      <span className="lbl">{t("systolicLabel")}</span>
                      <input
                        type="number"
                        name="systolicMmhg"
                        className="field tap-target"
                        style={{ width: "7rem" }}
                      />
                    </label>
                    <label>
                      <span className="lbl">{t("diastolicLabel")}</span>
                      <input
                        type="number"
                        name="diastolicMmhg"
                        className="field tap-target"
                        style={{ width: "7rem" }}
                      />
                    </label>
                    <label>
                      <span className="lbl">{t("pulseLabel")}</span>
                      <input
                        type="number"
                        name="pulseBpm"
                        className="field tap-target"
                        style={{ width: "7rem" }}
                      />
                    </label>
                    <label>
                      <span className="lbl">{t("weightLabel")}</span>
                      <input
                        type="number"
                        step="0.1"
                        name="weightKg"
                        className="field tap-target"
                        style={{ width: "7rem" }}
                      />
                    </label>
                    <label>
                      <span className="lbl">{t("temperatureLabel")}</span>
                      <input
                        type="number"
                        step="0.1"
                        name="temperatureF"
                        className="field tap-target"
                        style={{ width: "7rem" }}
                      />
                    </label>
                    <button type="submit" className="btn tap-target">
                      {t("saveVitals")}
                    </button>
                  </form>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {canAttachRecords && attachableAppointments.length > 0 && (
        <div className="slip mt-8">
          <h2 className="lbl" style={{ color: "var(--color-ink-soft)" }}>
            {t("attachRecordHeading")}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            {t("attachRecordPrompt")}
          </p>
          <form action={attachAction} className="mt-3 flex flex-wrap items-end gap-3">
            <label>
              <span className="lbl">{t("attachRecordPatientLabel")}</span>
              <select name="appointmentId" required className="field tap-target">
                {attachableAppointments.map((appt) => (
                  <option key={appt.appointmentId} value={appt.appointmentId}>
                    {appt.familyMemberFullName ?? appt.patientFullName} ·{" "}
                    {formatClinicDate(appt.scheduledStart, locale)}
                    {appt.familyMemberFullName ? ` (${appt.patientFullName})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="lbl">{t("recordTypeLabel")}</span>
              <select name="recordType" className="field tap-target">
                <option value="lab_report">{t("types.lab_report")}</option>
                <option value="prescription_photo">{t("types.prescription_photo")}</option>
                <option value="other_document">{t("types.other_document")}</option>
              </select>
            </label>
            <label>
              <span className="lbl">{t("fileLabel")}</span>
              <input
                type="file"
                name="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/heic"
                className="tap-target"
              />
            </label>
            <button type="submit" className="btn tap-target">
              {t("attachRecord")}
            </button>
          </form>
        </div>
      )}

      {waitlist.length > 0 && (
        <>
          <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
            {t("waitlistHeading")}
          </h2>
          <div className="slip mt-3">
            {waitlist.map((entry, i) => (
              <div key={entry.id} className="qrow">
                <span className="qn mono">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <b>{entry.patientFullName}</b>
                  <small>
                    {formatClinicDate(entry.requestedDate, locale)} ·{" "}
                    {entry.practitionerFullName}
                    {entry.subjectType === "family_member" && entry.familyMemberFullName
                      ? ` · ${entry.familyMemberFullName}`
                      : ""}
                    {entry.patientPhone ? ` · ${entry.patientPhone}` : ""}
                  </small>
                </div>
                <span className={`qs${entry.status === "offered" ? " in" : ""}`}>
                  {t(`waitlistStatus.${entry.status}` as "waitlistStatus.waiting")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
