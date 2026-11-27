import { CalendarCheck, CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listMyAppointments, listMyWaitlist } from "@/lib/api/booking";
import { listFamilyMembers } from "@/lib/api/patients";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/overlay";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import {
  cancelAppointmentAction,
  leaveWaitlistAction,
  rescheduleAppointmentAction,
} from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";

const REVIEWABLE_STATUSES = ["checked_in", "completed"];
const UPCOMING_STATUSES = ["booked", "checked_in"];
const ACTIVE_WAITLIST_STATUSES = ["waiting", "offered"];
const TABS = ["upcoming", "past", "waitlist"] as const;

const secondaryButtonClasses =
  "tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg";

export default async function AppointmentsPage(
  props: PageProps<"/[locale]/patient/appointments">,
) {
  const { locale } = await props.params;
  const { tab: tabParam } = await props.searchParams;
  const tab = TABS.find((x) => x === tabParam) ?? "upcoming";
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

  const upcoming = appointments.filter((a) => UPCOMING_STATUSES.includes(a.status));
  const past = appointments.filter((a) => !UPCOMING_STATUSES.includes(a.status));
  const activeWaitlistEntries = waitlistEntries.filter((e) =>
    ACTIVE_WAITLIST_STATUSES.includes(e.status),
  );
  const shown = tab === "past" ? past : upcoming;
  const subjectName = (entry: { subjectType: string; familyMemberId: string | null }) =>
    entry.subjectType === "family_member"
      ? ((entry.familyMemberId && familyMemberNameById.get(entry.familyMemberId)) ??
        t("forFamilyMember"))
      : t("forSelf");

  return (
    <div>
      <PageHeader icon={CalendarCheck} kicker="CareConnect" title={t("appointmentsHeading")} />

      <Tabs
        label={t("appointmentsHeading")}
        active={tab}
        items={[
          { key: "upcoming", label: t("tabUpcoming"), count: upcoming.length, href: "/patient/appointments" },
          { key: "past", label: t("tabPast"), count: past.length, href: "/patient/appointments?tab=past" },
          {
            key: "waitlist",
            label: t("myWaitlistHeading"),
            count: activeWaitlistEntries.length,
            href: "/patient/appointments?tab=waitlist",
          },
        ]}
      />

      {tab !== "waitlist" &&
        (shown.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={t("noAppointments")} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((appt) => (
              <li key={appt.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <b className="font-semibold text-text">
                      {formatClinicDateTime(appt.scheduledStart, locale)}
                    </b>
                    <StatusBadge
                      kind="appointment"
                      status={appt.status}
                      label={t(`status.${appt.status}` as "status.booked")}
                    />
                  </div>
                  <p className="text-sm text-text-muted">{appt.practitionerFullName}</p>
                  <p className="text-xs text-text-faint">{subjectName(appt)}</p>

                  {REVIEWABLE_STATUSES.includes(appt.status) && (
                    <Link
                      href={`/practitioners/${appt.practitionerSlug}#review-form`}
                      className="tap-target mt-1 inline-flex w-fit items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text no-underline transition hover:border-primary-500 hover:text-primary-700"
                    >
                      {t("leaveReview")}
                    </Link>
                  )}

                  {appt.status === "booked" && (
                    <div className="mt-auto flex flex-wrap items-start gap-3 border-t border-border pt-3">
                      <div>
                        <Modal
                          trigger={t("reschedule")}
                          title={t("reschedule")}
                          description={`${appt.practitionerFullName} · ${formatClinicDateTime(appt.scheduledStart, locale)}`}
                          formAction={rescheduleAction}
                          submitLabel={t("reschedule")}
                        >
                          <input type="hidden" name="appointmentId" value={appt.id} />
                          <FormField label={t("newTimeLabelPkt")}>
                            <input
                              type="datetime-local"
                              name="scheduledStart"
                              required
                              className="tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600"
                            />
                          </FormField>
                        </Modal>
                      </div>
                      <div>
                        <Modal
                          trigger={t("cancel")}
                          triggerVariant="danger"
                          title={t("cancelConfirmTitle")}
                          description={`${appt.practitionerFullName} · ${formatClinicDateTime(appt.scheduledStart, locale)}`}
                          formAction={cancelAction}
                          submitLabel={t("cancelAppointment")}
                          submitTone="danger"
                        >
                          <input type="hidden" name="appointmentId" value={appt.id} />
                          <p className="text-sm text-text-muted">{t("cancelConfirmBody")}</p>
                        </Modal>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ))}

      {tab === "waitlist" &&
        (activeWaitlistEntries.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t("noWaitlistEntries")} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeWaitlistEntries.map((entry) => (
              <li key={entry.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <b className="flex items-center gap-1.5 font-semibold text-text">
                      <CalendarClock aria-hidden className="size-4 text-text-muted" />
                      {formatClinicDate(entry.requestedDate, locale)}
                    </b>
                    <StatusBadge
                      kind="waitlist"
                      status={entry.status}
                      label={t(`waitlistStatus.${entry.status}` as "waitlistStatus.waiting")}
                    />
                  </div>
                  <p className="text-sm text-text-muted">{entry.practitionerFullName}</p>
                  <p className="text-xs text-text-faint">{entry.clinicName}</p>
                  <p className="text-xs text-text-faint">{subjectName(entry)}</p>
                  <form action={leaveWaitlist} className="mt-auto border-t border-border pt-3">
                    <input type="hidden" name="waitlistEntryId" value={entry.id} />
                    <SubmitButton className={secondaryButtonClasses}>{t("leaveWaitlist")}</SubmitButton>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
