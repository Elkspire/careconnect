import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getAppointmentAllergies,
  getClinicalNote,
  getPrescription,
} from "@/lib/api/clinical";
import { getVitals } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import {
  saveClinicalNoteAction,
  saveClinicalPrescriptionAction,
} from "../../../../actions";

const PRESCRIPTION_ROWS = 8;

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
        <div className="locked">
          <div className="lockmsg">
            <span className="mono">{t("accessDenied")}</span>
          </div>
        </div>
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
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("notesHeading")}</h1>

      {allergies.length > 0 && (
        <div className="flagrow mt-4">
          {allergies.map((a) => (
            <span key={a} className="flag mono">
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="card mt-4">
        <p className="lbl">{t("vitalsSummaryHeading")}</p>
        {vitals ? (
          <>
            <div className="pgrid mt-2">
              {(vitals.systolicMmhg !== null || vitals.diastolicMmhg !== null) && (
                <div className="trow">
                  <span>{t("bloodPressureLabel")}</span>
                  <b className="mono">
                    {vitals.systolicMmhg ?? "—"}/{vitals.diastolicMmhg ?? "—"}
                  </b>
                </div>
              )}
              {vitals.pulseBpm !== null && (
                <div className="trow">
                  <span>{t("pulseLabel")}</span>
                  <b className="mono">{vitals.pulseBpm}</b>
                </div>
              )}
              {vitals.weightKg !== null && (
                <div className="trow">
                  <span>{t("weightLabel")}</span>
                  <b className="mono">{vitals.weightKg}</b>
                </div>
              )}
              {vitals.temperatureF !== null && (
                <div className="trow">
                  <span>{t("temperatureLabel")}</span>
                  <b className="mono">{vitals.temperatureF}</b>
                </div>
              )}
            </div>
            <small className="mt-2 block" style={{ color: "var(--color-ink-soft)" }}>
              {t("recordedByLabel", { name: vitals.recordedByName ?? vitals.recordedByPhone ?? "" })}
            </small>
          </>
        ) : (
          <p style={{ color: "var(--color-ink-soft)" }}>{t("noVitalsRecorded")}</p>
        )}
      </div>

      {warned.length > 0 && (
        <div className="alert mt-4">
          <div>
            <b>{t("allergyWarningTitle")}</b>
            <p>{t("allergyWarningBody", { drugs: warned.join(", ") })}</p>
          </div>
        </div>
      )}

      <div className="rx mt-6">
        <div className="rxh">
          <span className="rxsym">℞</span>
          <b className="disp">{t("notesHeading")}</b>
        </div>
        <form action={action} className="flex flex-col gap-4">
          <label>
            <span className="lbl">{t("notesLabel")}</span>
            <textarea
              name="notes"
              required
              defaultValue={note?.notes}
              rows={6}
              className="field"
            />
          </label>
          <label>
            <span className="lbl">{t("diagnosisLabel")}</span>
            <input
              type="text"
              name="diagnosis"
              defaultValue={note?.diagnosis ?? ""}
              className="field tap-target"
            />
          </label>
          <button type="submit" className="btn tap-target self-start">
            {t("saveNote")}
          </button>
        </form>
      </div>

      {note && (
        <div className="rx mt-6">
          <div className="rxh">
            <span className="rxsym">℞</span>
            <b className="disp">{t("prescriptionHeading")}</b>
          </div>
          <form action={prescriptionAction} className="flex flex-col gap-3">
            {rows.map((item, i) => (
              <div key={i} className="rxline flex-wrap gap-2 sm:flex-nowrap">
                <input
                  type="text"
                  name={`drugName${i + 1}`}
                  defaultValue={item?.drugName ?? ""}
                  placeholder={t("drugNameLabel")}
                  className="field tap-target"
                  style={{ flex: "1 1 160px" }}
                />
                <input
                  type="text"
                  name={`dosage${i + 1}`}
                  defaultValue={item?.dosage ?? ""}
                  placeholder={t("dosageLabel")}
                  className="field tap-target"
                  style={{ flex: "1 1 90px" }}
                />
                <input
                  type="text"
                  name={`frequency${i + 1}`}
                  defaultValue={item?.frequency ?? ""}
                  placeholder={t("frequencyLabel")}
                  className="field tap-target"
                  style={{ flex: "1 1 90px" }}
                />
                <input
                  type="text"
                  name={`duration${i + 1}`}
                  defaultValue={item?.duration ?? ""}
                  placeholder={t("durationLabel")}
                  className="field tap-target"
                  style={{ flex: "1 1 90px" }}
                />
                <input
                  type="text"
                  name={`instructions${i + 1}`}
                  defaultValue={item?.instructions ?? ""}
                  placeholder={t("instructionsLabel")}
                  className="field tap-target"
                  style={{ flex: "1 1 140px" }}
                />
              </div>
            ))}

            <label className="rxfoot flex items-start gap-2">
              <input type="checkbox" required className="tap-target" style={{ marginTop: 3 }} />
              <span className="text-sm">
                {allergies.length > 0
                  ? t("reviewedAllergiesLabel")
                  : t("reviewedNoAllergiesLabel")}
              </span>
            </label>

            <button type="submit" className="btn tap-target self-start">
              {t("savePrescription")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
