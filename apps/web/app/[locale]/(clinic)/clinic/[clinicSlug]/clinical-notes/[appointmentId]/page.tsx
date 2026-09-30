import { NotebookPen, Pill } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getAppointmentAllergies,
  getClinicalNote,
  getPrescription,
} from "@/lib/api/clinical";
import { getVitals } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ListRow } from "@/components/ui/list-row";
import { FormField } from "@/components/ui/form-field";
import {
  saveClinicalNoteAction,
  saveClinicalPrescriptionAction,
} from "../../../../actions";

const PRESCRIPTION_ROWS = 8;
const inputClasses =
  "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default async function ClinicalNotePage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/clinical-notes/[appointmentId]">,
) {
  const { locale, clinicSlug, appointmentId } = await props.params;
  const sp = await props.searchParams;
  const warned = typeof sp.warned === "string" ? sp.warned.split(",").filter(Boolean) : [];
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }
  const clinicId = staffCtx.clinicId;

  // Server-side role check — not just an absent nav link. The API already
  // enforces this (ClinicalController requires owner/junior_doctor via
  // ClinicRoleGuard), this is a second, independent check so the page
  // itself never even fetches clinical data for a receptionist. Matches
  // the plan's requirement that the clinical/receptionist boundary isn't
  // UI hiding on either side.
  if (staffCtx.role !== "owner" && staffCtx.role !== "junior_doctor") {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title={t("accessDenied")} />
      </div>
    );
  }

  const [note, allergies, prescriptionItems, vitals] = await Promise.all([
    getClinicalNote(clinicId, appointmentId),
    getAppointmentAllergies(clinicId, appointmentId),
    getPrescription(clinicId, appointmentId),
    getVitals(clinicId, appointmentId),
  ]);
  const action = saveClinicalNoteAction.bind(
    null,
    locale,
    clinicSlug,
    clinicId,
    appointmentId,
    note !== null,
  );
  const prescriptionAction = saveClinicalPrescriptionAction.bind(
    null,
    locale,
    clinicSlug,
    clinicId,
    appointmentId,
  );
  const rows = Array.from({ length: PRESCRIPTION_ROWS }, (_, i) => prescriptionItems[i] ?? null);

  return (
    <div className="max-w-2xl">
      <PageHeader icon={NotebookPen} kicker="CareConnect" title={t("notesHeading")} />

      {allergies.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {allergies.map((a) => (
            <Badge key={a} tone="red">
              {a}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("vitalsSummaryHeading")}
        </p>
        {vitals ? (
          <>
            <div className="mt-2 flex flex-col">
              {(vitals.systolicMmhg !== null || vitals.diastolicMmhg !== null) && (
                <ListRow
                  title={t("bloodPressureLabel")}
                  meta={`${vitals.systolicMmhg ?? "—"}/${vitals.diastolicMmhg ?? "—"}`}
                />
              )}
              {vitals.pulseBpm !== null && (
                <ListRow title={t("pulseLabel")} meta={vitals.pulseBpm} />
              )}
              {vitals.weightKg !== null && (
                <ListRow title={t("weightLabel")} meta={vitals.weightKg} />
              )}
              {vitals.temperatureF !== null && (
                <ListRow title={t("temperatureLabel")} meta={vitals.temperatureF} />
              )}
            </div>
            <small className="mt-2 block text-xs text-text-muted">
              {t("recordedByLabel", { name: vitals.recordedByName ?? vitals.recordedByPhone ?? "" })}
            </small>
          </>
        ) : (
          <p className="mt-2 text-sm text-text-muted">{t("noVitalsRecorded")}</p>
        )}
      </Card>

      {warned.length > 0 && (
        <div className="mt-4">
          <Alert
            tone="danger"
            title={t("allergyWarningTitle")}
            description={t("allergyWarningBody", { drugs: warned.join(", ") })}
          />
        </div>
      )}

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <NotebookPen aria-hidden className="size-4 text-primary-600" />
          <b className="font-semibold text-text">{t("notesHeading")}</b>
        </div>
        <form action={action} className="flex flex-col gap-4">
          <FormField label={t("notesLabel")}>
            <textarea
              name="notes"
              required
              defaultValue={note?.notes}
              rows={6}
              className={inputClasses}
            />
          </FormField>
          <FormField label={t("diagnosisLabel")}>
            <input
              type="text"
              name="diagnosis"
              defaultValue={note?.diagnosis ?? ""}
              className={inputClasses}
            />
          </FormField>
          <button
            type="submit"
            className="tap-target self-start rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
          >
            {t("saveNote")}
          </button>
        </form>
      </Card>

      {note && (
        <Card padding="lg" className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <Pill aria-hidden className="size-4 text-primary-600" />
            <b className="font-semibold text-text">{t("prescriptionHeading")}</b>
          </div>
          <form action={prescriptionAction} className="flex flex-col gap-3">
            {rows.map((item, i) => (
              <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  type="text"
                  name={`drugName${i + 1}`}
                  defaultValue={item?.drugName ?? ""}
                  placeholder={t("drugNameLabel")}
                  className={`${inputClasses} flex-[1_1_160px]`}
                />
                <input
                  type="text"
                  name={`dosage${i + 1}`}
                  defaultValue={item?.dosage ?? ""}
                  placeholder={t("dosageLabel")}
                  className={`${inputClasses} flex-[1_1_90px]`}
                />
                <input
                  type="text"
                  name={`frequency${i + 1}`}
                  defaultValue={item?.frequency ?? ""}
                  placeholder={t("frequencyLabel")}
                  className={`${inputClasses} flex-[1_1_90px]`}
                />
                <input
                  type="text"
                  name={`duration${i + 1}`}
                  defaultValue={item?.duration ?? ""}
                  placeholder={t("durationLabel")}
                  className={`${inputClasses} flex-[1_1_90px]`}
                />
                <input
                  type="text"
                  name={`instructions${i + 1}`}
                  defaultValue={item?.instructions ?? ""}
                  placeholder={t("instructionsLabel")}
                  className={`${inputClasses} flex-[1_1_140px]`}
                />
              </div>
            ))}

            <label className="flex items-start gap-2 border-t border-border pt-3">
              <input type="checkbox" required className="mt-0.5 size-4 accent-primary-600" />
              <span className="text-sm text-text">
                {allergies.length > 0
                  ? t("reviewedAllergiesLabel")
                  : t("reviewedNoAllergiesLabel")}
              </span>
            </label>

            <button
              type="submit"
              className="tap-target self-start rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
            >
              {t("savePrescription")}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
