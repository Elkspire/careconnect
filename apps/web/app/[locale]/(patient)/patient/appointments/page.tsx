import { CalendarCheck, CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listMyAppointments, listMyWaitlist } from "@/lib/api/booking";
import { listFamilyMembers } from "@/lib/api/patients";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import {
  cancelAppointmentAction,
  leaveWaitlistAction,
  rescheduleAppointmentAction,
} from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";

const REVIEWABLE_STATUSES = ["checked_in", "completed"];
const ACTIVE_WAITLIST_STATUSES = ["waiting", "offered"];

const BOOKING_ERRORS = ["unavailable", "window", "changed"] as const;

const STATUS_TONE = {
  booked: "blue",
  checked_in: "purple",
  completed: "green",
  cancelled: "gray",
  no_show: "red",
} as const;

export default async function AppointmentsPage(
  props: PageProps<"/[locale]/patient/appointments">,
) {
  const { locale } = await props.params;
  const { error: errorCode } = await props.searchParams;
  const error = BOOKING_ERRORS.find((code) => code === errorCode);
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
    <div>
      <PageHeader icon={CalendarCheck} kicker="CareConnect" title={t("appointmentsHeading")} />

      {error && (
        <div className="mb-5">
          <Alert tone="danger" title={t(`bookingError.${error}`)} />
        </div>
      )}

      {appointments.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t("noAppointments")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {appointments.map((appt) => (
            <li key={appt.id}>
              <Card className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <b className="font-semibold text-text">
                    {formatClinicDateTime(appt.scheduledStart, locale)}
                  </b>
                  <Badge tone={STATUS_TONE[appt.status as keyof typeof STATUS_TONE] ?? "gray"}>
                    {t(`status.${appt.status}` as "status.booked")}
                  </Badge>
                </div>
                <p className="text-sm text-text-muted">{appt.practitionerFullName}</p>
                <p className="text-xs text-text-faint">
                  {appt.subjectType === "family_member"
                    ? (appt.familyMemberId && familyMemberNameById.get(appt.familyMemberId)) ??
                      t("forFamilyMember")
                    : t("forSelf")}
                </p>

                {REVIEWABLE_STATUSES.includes(appt.status) && (
                  <Link
                    href={`/practitioners/${appt.practitionerSlug}#review-form`}
                    className="tap-target mt-1 inline-flex w-fit items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
                  >
                    {t("leaveReview")}
                  </Link>
                )}

                {appt.status === "booked" && (
                  <div className="mt-auto flex flex-wrap items-end gap-3 border-t border-border pt-3">
                    <form action={rescheduleAction} className="flex items-end gap-2">
                      <input type="hidden" name="appointmentId" value={appt.id} />
                      <FormField label={t("newTimeLabelPkt")}>
                        <input
                          type="datetime-local"
                          name="scheduledStart"
                          required
                          className="tap-target rounded-md border border-border-strong px-2 py-1.5 text-xs text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600"
                        />
                      </FormField>
                      <SubmitButton
                        className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
                      >
                        {t("reschedule")}
                      </SubmitButton>
                    </form>

                    <form action={cancelAction}>
                      <input type="hidden" name="appointmentId" value={appt.id} />
                      <SubmitButton
                        className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg"
                      >
                        {t("cancel")}
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {activeWaitlistEntries.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-base font-bold text-text">
            {t("myWaitlistHeading")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeWaitlistEntries.map((entry) => (
              <li key={entry.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <b className="flex items-center gap-1.5 font-semibold text-text">
                      <CalendarClock aria-hidden className="size-4 text-text-muted" />
                      {formatClinicDate(entry.requestedDate, locale)}
                    </b>
                    <Badge tone={entry.status === "offered" ? "blue" : "gray"}>
                      {t(`waitlistStatus.${entry.status}` as "waitlistStatus.waiting")}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-muted">{entry.practitionerFullName}</p>
                  <p className="text-xs text-text-faint">{entry.clinicName}</p>
                  <p className="text-xs text-text-faint">
                    {entry.subjectType === "family_member"
                      ? (entry.familyMemberId && familyMemberNameById.get(entry.familyMemberId)) ??
                        t("forFamilyMember")
                      : t("forSelf")}
                  </p>
                  <form action={leaveWaitlist} className="mt-auto border-t border-border pt-3">
                    <input type="hidden" name="waitlistEntryId" value={entry.id} />
                    <SubmitButton
                      className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg"
                    >
                      {t("leaveWaitlist")}
                    </SubmitButton>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
