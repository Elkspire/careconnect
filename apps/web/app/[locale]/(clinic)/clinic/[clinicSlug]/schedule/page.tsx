import { Clock } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WEEKDAY_KEYS, type WeekdayKey, type WeeklyTimings } from "@careconnect/validation";
import { getPractitionerConfig, type PractitionerConfig } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { saveWorkingHoursAction } from "../../../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

const inputClasses =
  "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const timeInputClasses =
  "tap-target w-[7.5rem] rounded-md border border-border px-2 py-1.5 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const primaryButtonClasses =
  "tap-target self-start rounded-md bg-primary-700 px-5 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800";

const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60] as const;

// What a doctor who has never saved hours starts from: a typical Pakistani
// clinic split — late morning plus evening, six days a week. They still
// have to enter a fee and press Save before patients can book.
const DEFAULT_TIMINGS: WeeklyTimings = {
  mon: [{ start: "10:00", end: "14:00" }, { start: "17:00", end: "21:00" }],
  tue: [{ start: "10:00", end: "14:00" }, { start: "17:00", end: "21:00" }],
  wed: [{ start: "10:00", end: "14:00" }, { start: "17:00", end: "21:00" }],
  thu: [{ start: "10:00", end: "14:00" }, { start: "17:00", end: "21:00" }],
  fri: [{ start: "10:00", end: "13:00" }, { start: "17:00", end: "21:00" }],
  sat: [{ start: "10:00", end: "14:00" }],
  sun: [],
};

/**
 * Owner-only: this doctor's own weekly hours and booking rules at this
 * clinic. Bookable slots are generated from exactly these settings (see
 * the API's availability.ts), and a doctor with none saved doesn't appear
 * in the directory at all — so this is what makes a newly registered
 * doctor bookable.
 */
export default async function ClinicSchedulePage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/schedule">,
) {
  const { locale, clinicSlug } = await props.params;
  const sp = await props.searchParams;
  const saved = sp.saved === "1";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic.workingHours"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }
  if (staffCtx.role !== "owner") {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title={t("ownerOnly")} />
      </div>
    );
  }

  const config: PractitionerConfig | null = await getPractitionerConfig(staffCtx.clinicId);
  const timings = config?.timings ?? DEFAULT_TIMINGS;
  const save = saveWorkingHoursAction.bind(null, locale, clinicSlug, staffCtx.clinicId);

  return (
    <div className="max-w-3xl">
      <PageHeader icon={Clock} kicker="CareConnect" title={t("heading")} />
      <p className="-mt-2 mb-5 text-sm text-text-muted">{t("intro")}</p>

      {!config && (
        <div className="mb-4">
          <Alert tone="warning" title={t("notSetTitle")} description={t("notSetBody")} />
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <Alert tone="success" title={t("saved")} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="danger" title={error} />
        </div>
      )}

      <form action={save} className="flex flex-col gap-6">
        <Card padding="lg">
          <h2 className="text-base font-bold text-text">{t("bookingHeading")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label={t("feeLabel")} hint={t("feeHint")}>
              <input
                type="number"
                name="consultationFee"
                min={0}
                step={50}
                required
                defaultValue={config?.consultationFee}
                placeholder="1500"
                className={inputClasses}
              />
            </FormField>
            <FormField label={t("slotLengthLabel")} hint={t("slotLengthHint")}>
              <select
                name="slotLengthMinutes"
                defaultValue={config?.slotLengthMinutes ?? 20}
                className={inputClasses}
              >
                {SLOT_LENGTHS.map((m) => (
                  <option key={m} value={m}>
                    {t("minutes", { count: m })}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t("dailyCapLabel")} hint={t("dailyCapHint")}>
              <input
                type="number"
                name="dailyPatientCap"
                min={1}
                defaultValue={config?.dailyPatientCap ?? undefined}
                className={inputClasses}
              />
            </FormField>
            <FormField label={t("cancellationLabel")} hint={t("cancellationHint")}>
              <input
                type="number"
                name="cancellationWindowHours"
                min={0}
                max={168}
                required
                defaultValue={config?.cancellationWindowHours ?? 24}
                className={inputClasses}
              />
            </FormField>
          </div>
          <label className="mt-5 flex items-start gap-3 text-sm text-text">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={config?.isActive ?? true}
              className="mt-0.5 size-4 accent-primary-600"
            />
            <span>
              <span className="block font-medium">{t("activeLabel")}</span>
              <span className="block text-xs text-text-muted">{t("activeHint")}</span>
            </span>
          </label>
        </Card>

        <Card padding="lg">
          <h2 className="text-base font-bold text-text">{t("weekHeading")}</h2>
          <p className="mt-1 text-xs text-text-muted">{t("weekHint")}</p>
          <div className="mt-4 flex flex-col divide-y divide-border">
            {WEEKDAY_KEYS.map((day) => (
              <DayRow key={day} day={day} ranges={timings[day] ?? []} t={t} />
            ))}
          </div>
        </Card>

        <button type="submit" className={primaryButtonClasses}>
          {t("save")}
        </button>
      </form>
    </div>
  );
}

function DayRow({
  day,
  ranges,
  t,
}: {
  day: WeekdayKey;
  ranges: Array<{ start: string; end: string }>;
  t: Awaited<ReturnType<typeof getTranslations<"clinic.workingHours">>>;
}) {
  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <label className="flex w-36 shrink-0 items-center gap-2 text-sm font-medium text-text">
        <input
          type="checkbox"
          name={`${day}.open`}
          defaultChecked={ranges.length > 0}
          className="size-4 accent-primary-600"
        />
        {t(`days.${day}`)}
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {[1, 2].map((n) => {
          const range = ranges[n - 1];
          return (
            <div key={n} className="flex items-center gap-1.5">
              <input
                type="time"
                name={`${day}.start${n}`}
                defaultValue={range?.start}
                aria-label={t("rangeStart", { day: t(`days.${day}`), n })}
                className={timeInputClasses}
              />
              <span className="text-xs text-text-muted">–</span>
              <input
                type="time"
                name={`${day}.end${n}`}
                defaultValue={range?.end}
                aria-label={t("rangeEnd", { day: t(`days.${day}`), n })}
                className={timeInputClasses}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
