import { CalendarPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAvailability } from "@/lib/api/booking";
import { getPractitionerProfile } from "@/lib/api/directory";
import { listFamilyMembers } from "@/lib/api/patients";
import { clinicTodayIso, formatClinicTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { BookingDatePicker } from "@/components/booking-date-picker";
import { createAppointmentAction, joinWaitlistAction } from "../../../../actions";
import { SubmitButton } from "@/components/ui/submit-button";

const inputClasses =
  "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default async function BookAppointmentPage(
  props: PageProps<"/[locale]/patient/book/[practitionerSlug]/[clinicSlug]">,
) {
  const { locale, practitionerSlug, clinicSlug } = await props.params;
  const sp = await props.searchParams;
  const today = clinicTodayIso();
  const date = typeof sp.date === "string" && sp.date ? sp.date : today;

  const [t, profile] = await Promise.all([
    getTranslations("patient"),
    getPractitionerProfile(practitionerSlug),
  ]);

  // Slugs are the public-facing identifier, but the API's booking endpoints
  // still key on the real practitioner/clinic UUIDs — resolve them here,
  // server-side, before making any booking call.
  const clinic = profile?.clinics.find((c) => c.slug === clinicSlug);
  if (!profile || !clinic) {
    notFound();
  }
  const practitionerId = profile.id;
  const clinicId = clinic.id;

  const [days, familyMembers] = await Promise.all([
    getAvailability({ practitionerId, clinicId, fromDate: date, toDate: date }),
    listFamilyMembers(),
  ]);
  const action = createAppointmentAction.bind(null, locale);
  const waitlistAction = joinWaitlistAction.bind(null, locale);
  const slots = days[0]?.slots ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader icon={CalendarPlus} kicker="CareConnect" title={t("bookingHeading")} />

      <Card padding="lg">
        {/* Choosing a date loads its times straight away (see
            BookingDatePicker). The GET form and its button only matter
            without JavaScript, so the button is in <noscript>. */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <BookingDatePicker
            label={t("pickDate")}
            loadingLabel={t("loadingSlots")}
            date={date}
            minDate={today}
            className={inputClasses}
          />
          <noscript>
            <button
              type="submit"
              className="tap-target rounded-md border border-border px-4 py-2 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
            >
              {t("pickDate")}
            </button>
          </noscript>
        </form>

        <div className="my-4 border-t border-border" />

        {familyMembers.length > 0 && (
          <div className="mb-4">
            <FormField label={t("forFamilyMember")}>
              <select name="familyMemberId" form="booking-form" className={inputClasses}>
                <option value="">{t("forSelf")}</option>
                {familyMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        )}

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("availableSlots")}
        </h4>

        {
          // A single form covers both the slot grid and the waitlist
          // fallback, not two separate forms — the family-member select
          // above belongs to whichever action fires, and `formAction`
          // lets one submit button (Join waitlist) override the form's
          // default action without duplicating the family-member field.
        }
        <form id="booking-form" action={action}>
          <input type="hidden" name="practitionerId" value={practitionerId} />
          <input type="hidden" name="clinicId" value={clinicId} />
          <input type="hidden" name="requestedDate" value={date} />
          {slots.length === 0 ? (
            <div>
              <p className="text-sm text-text-muted">{t("noSlots")}</p>
              <SubmitButton
                formAction={waitlistAction}
                className="tap-target mt-3 rounded-md border border-border px-4 py-2 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
              >
                {t("joinWaitlist")}
              </SubmitButton>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {slots.map((slot) => (
                <SubmitButton
                  key={slot.start}
                  name="scheduledStart"
                  value={slot.start}
                  className="tap-target rounded-md border border-border bg-surface py-2.5 text-sm font-medium text-text transition hover:border-primary-500 hover:bg-primary-50"
                >
                  {formatClinicTime(slot.start, locale)}
                </SubmitButton>
              ))}
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
