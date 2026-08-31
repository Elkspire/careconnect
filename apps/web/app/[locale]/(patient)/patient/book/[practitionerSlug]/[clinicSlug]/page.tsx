import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAvailability } from "@/lib/api/booking";
import { getPractitionerProfile } from "@/lib/api/directory";
import { listFamilyMembers } from "@/lib/api/patients";
import { clinicTodayIso, formatClinicTime } from "@/lib/format-time";
import { createAppointmentAction, joinWaitlistAction } from "../../../../actions";

export default async function BookAppointmentPage(
  props: PageProps<"/[locale]/patient/book/[practitionerSlug]/[clinicSlug]">,
) {
  const { locale, practitionerSlug, clinicSlug } = await props.params;
  const sp = await props.searchParams;
  const date = typeof sp.date === "string" && sp.date ? sp.date : clinicTodayIso();

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
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("bookingHeading")}</h1>

      <div className="slip mt-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label>
            <span className="lbl">{t("pickDate")}</span>
            <input type="date" name="date" defaultValue={date} className="field tap-target" />
          </label>
          <button type="submit" className="btn gh sm tap-target">
            {t("pickDate")}
          </button>
        </form>

        <div className="rule" />

        {familyMembers.length > 0 && (
          <label className="mb-4 block">
            <span className="lbl">{t("forFamilyMember")}</span>
            <select name="familyMemberId" form="booking-form" className="field tap-target">
              <option value="">{t("forSelf")}</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
        )}

        <h4 className="lbl">{t("availableSlots")}</h4>

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
            <div className="mt-2">
              <p style={{ color: "var(--color-ink-soft)" }}>{t("noSlots")}</p>
              <button
                type="submit"
                formAction={waitlistAction}
                className="btn gh sm tap-target mt-3"
              >
                {t("joinWaitlist")}
              </button>
            </div>
          ) : (
            <div className="slots">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="submit"
                  name="scheduledStart"
                  value={slot.start}
                  className="slot tap-target"
                >
                  {formatClinicTime(slot.start, locale)}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
