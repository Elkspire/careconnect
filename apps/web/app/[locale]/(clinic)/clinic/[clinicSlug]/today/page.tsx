import { ChevronDown, Clock3, ListChecks, Upload, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listAppointmentsForAttach, listClinicWaitlist, listToday } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate, formatClinicTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { attachRecordAction, checkInAction, recordVitalsAction } from "../../../actions";

const inputClasses =
  "tap-target rounded-md border border-border px-2.5 py-1.5 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const wideInputClasses =
  "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const primaryButtonClasses =
  "tap-target flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800";
const secondaryButtonClasses =
  "tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700";

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
  // Vitals are pre-consult, recorded after check-in and before the
  // doctor's own consultation — owner or an assigned junior doctor
  // (journeys.html's "Assistant" track, folded into junior_doctor).
  const canRecordVitals = staffCtx.role === "owner" || staffCtx.role === "junior_doctor";
  // Same role set today as canRecordVitals, but a distinct permission
  // (attachRecords) — kept as its own check since they could diverge.
  const canAttachRecords = staffCtx.role === "owner" || staffCtx.role === "junior_doctor";

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
    <div>
      <PageHeader icon={ListChecks} kicker={staffCtx.clinicName} title={t("todayHeading")} />

      <StatGrid>
        <StatTile icon={Clock3} value={appointments.length} label={t("todayHeading")} />
        <StatTile icon={ListChecks} value={checkedInCount} label={t("checkedIn")} />
        <StatTile icon={Users} value={waitingCount} label={t("checkIn")} />
      </StatGrid>

      <div className="mt-6">
        {appointments.length === 0 ? (
          <EmptyState icon={Clock3} title={t("noAppointmentsToday")} />
        ) : (
          <Card>
            {appointments.map((appt, i) => (
              <div key={appt.appointmentId} className="border-b border-border py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-sm font-semibold text-text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate font-semibold text-text">
                      {appt.patientFullName}
                    </b>
                    <small className="block truncate text-xs text-text-muted">
                      {formatClinicTime(appt.scheduledStart, locale)} · {appt.patientPhone}
                    </small>
                  </div>
                  {appt.status === "checked_in" ? (
                    <Badge tone="green">{t("checkedIn")}</Badge>
                  ) : canCheckIn ? (
                    <form action={action}>
                      <input type="hidden" name="appointmentId" value={appt.appointmentId} />
                      <button type="submit" className={secondaryButtonClasses}>
                        {t("checkIn")}
                      </button>
                    </form>
                  ) : (
                    <Badge tone="gray">{t("notCheckedIn")}</Badge>
                  )}
                </div>
                {appt.status === "checked_in" && canRecordVitals && (
                  <details className="group ms-9 mt-1.5">
                    <summary className="tap-target flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-semibold text-primary-700">
                      {t("recordVitals")}
                      <ChevronDown aria-hidden className="size-3.5 transition group-open:rotate-180" />
                    </summary>
                    <form action={vitalsAction} className="mt-2 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="appointmentId" value={appt.appointmentId} />
                      <FormField label={t("systolicLabel")}>
                        <input type="number" name="systolicMmhg" className={`${inputClasses} w-28`} />
                      </FormField>
                      <FormField label={t("diastolicLabel")}>
                        <input type="number" name="diastolicMmhg" className={`${inputClasses} w-28`} />
                      </FormField>
                      <FormField label={t("pulseLabel")}>
                        <input type="number" name="pulseBpm" className={`${inputClasses} w-28`} />
                      </FormField>
                      <FormField label={t("weightLabel")}>
                        <input
                          type="number"
                          step="0.1"
                          name="weightKg"
                          className={`${inputClasses} w-28`}
                        />
                      </FormField>
                      <FormField label={t("temperatureLabel")}>
                        <input
                          type="number"
                          step="0.1"
                          name="temperatureF"
                          className={`${inputClasses} w-28`}
                        />
                      </FormField>
                      <button type="submit" className={primaryButtonClasses}>
                        {t("saveVitals")}
                      </button>
                    </form>
                  </details>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>

      {canAttachRecords && attachableAppointments.length > 0 && (
        <Card padding="lg" className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("attachRecordHeading")}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t("attachRecordPrompt")}</p>
          <form action={attachAction} className="mt-3 flex flex-wrap items-end gap-3">
            <FormField label={t("attachRecordPatientLabel")}>
              <select name="appointmentId" required className={wideInputClasses}>
                {attachableAppointments.map((appt) => (
                  <option key={appt.appointmentId} value={appt.appointmentId}>
                    {appt.familyMemberFullName ?? appt.patientFullName} ·{" "}
                    {formatClinicDate(appt.scheduledStart, locale)}
                    {appt.familyMemberFullName ? ` (${appt.patientFullName})` : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t("recordTypeLabel")}>
              <select name="recordType" className={wideInputClasses}>
                <option value="lab_report">{t("types.lab_report")}</option>
                <option value="prescription_photo">{t("types.prescription_photo")}</option>
                <option value="other_document">{t("types.other_document")}</option>
              </select>
            </FormField>
            <FormField label={t("fileLabel")}>
              <input
                type="file"
                name="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/heic"
                className="tap-target text-sm"
              />
            </FormField>
            <button type="submit" className={primaryButtonClasses}>
              <Upload aria-hidden className="size-4" />
              {t("attachRecord")}
            </button>
          </form>
        </Card>
      )}

      {waitlist.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("waitlistHeading")}
          </h2>
          <Card>
            {waitlist.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <span className="w-6 shrink-0 text-sm font-semibold text-text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate font-semibold text-text">{entry.patientFullName}</b>
                  <small className="block truncate text-xs text-text-muted">
                    {formatClinicDate(entry.requestedDate, locale)} · {entry.practitionerFullName}
                    {entry.subjectType === "family_member" && entry.familyMemberFullName
                      ? ` · ${entry.familyMemberFullName}`
                      : ""}
                    {entry.patientPhone ? ` · ${entry.patientPhone}` : ""}
                  </small>
                </div>
                <Badge tone={entry.status === "offered" ? "blue" : "gray"}>
                  {t(`waitlistStatus.${entry.status}` as "waitlistStatus.waiting")}
                </Badge>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
