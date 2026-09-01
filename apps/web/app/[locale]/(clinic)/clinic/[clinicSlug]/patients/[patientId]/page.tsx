import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import {
  getClinicPatientDetail,
  getPatientMedicalSummary,
  listPatientRecords,
} from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format-time";
import { upsertClinicMedicalSummaryAction, viewClinicRecordAction } from "../../../../actions";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default async function ClinicPatientDetailPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/patients/[patientId]">,
) {
  const { locale, clinicSlug, patientId } = await props.params;
  const [t, tPatient, tVault, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    getTranslations("patient"),
    getTranslations("vault"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }
  const clinicId = staffCtx.clinicId;
  // Owner and junior doctor both get full clinical visibility (records,
  // clinical notes); receptionist never does — see the product doc's role
  // matrix in section 3.5.
  const canViewClinical = staffCtx.role === "owner" || staffCtx.role === "junior_doctor";

  const detail = await getClinicPatientDetail(clinicId, patientId).catch(() => null);
  if (!detail) {
    notFound();
  }
  const { patient, appointments, familyMembers } = detail;
  const [records, medicalSummary] = canViewClinical
    ? await Promise.all([
        listPatientRecords(clinicId, patientId),
        getPatientMedicalSummary(clinicId, patientId),
      ])
    : [[], null];
  const viewRecord = viewClinicRecordAction.bind(null, clinicId);
  const saveSummary = upsertClinicMedicalSummaryAction.bind(null, locale, clinicSlug, clinicId, patientId);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/clinic/${clinicSlug}/patients`}
        locale={locale as AppLocale}
        className="mono text-xs"
        style={{ color: "var(--color-verified)" }}
      >
        ← {t("backToPatients")}
      </Link>

      <p className="kicker mt-4" style={{ color: "var(--color-verified)" }}>
        {t("patientsHeading")}
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{patient.fullName}</h1>

      <div className="card mt-6">
        <div className="pgrid">
          <div className="prow">
            <span>{t("phoneLabel")}</span>
            <em>{patient.phone ?? "—"}</em>
          </div>
          {patient.email && (
            <div className="prow">
              <span>{t("emailLabel")}</span>
              <em>{patient.email}</em>
            </div>
          )}
          {patient.gender && (
            <div className="prow">
              <span>{t("genderLabel")}</span>
              <em>{patient.gender}</em>
            </div>
          )}
          {patient.dob && (
            <div className="prow">
              <span>{t("dobLabel")}</span>
              <em>{patient.dob}</em>
            </div>
          )}
        </div>
      </div>

      {canViewClinical && (
        <div className="chart mt-6">
          <div className="cn">
            <b>{t("medicalSummaryHeading")}</b>
          </div>
          {medicalSummary &&
          (medicalSummary.bloodGroup ||
            medicalSummary.allergies.length > 0 ||
            medicalSummary.chronicConditions.length > 0) ? (
            <div className="flagrow">
              {medicalSummary.allergies.map((a) => (
                <span key={a} className="flag mono">
                  {a}
                </span>
              ))}
              {medicalSummary.chronicConditions.map((c) => (
                <span key={c} className="flag mono">
                  {c}
                </span>
              ))}
              {medicalSummary.bloodGroup && (
                <span className="flag n mono">{medicalSummary.bloodGroup}</span>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {tVault("noMedicalSummary")}
            </p>
          )}
          {medicalSummary && medicalSummary.activeMedications.length > 0 && (
            <>
              <h4 className="lbl mt-3">{tVault("activeMedicationsLabel")}</h4>
              <ul className="mt-1 grid gap-1">
                {medicalSummary.activeMedications.map((m) => (
                  <li key={m} className="text-sm">
                    {m}
                  </li>
                ))}
              </ul>
            </>
          )}

          <details className="mt-3">
            <summary
              className="mono text-xs tap-target"
              style={{ color: "var(--color-verified)" }}
            >
              {tVault("editMedicalSummary")}
            </summary>
            <form action={saveSummary} className="mt-3 flex flex-col gap-3">
              <label>
                <span className="lbl">{tVault("bloodGroupLabel")}</span>
                <select
                  name="bloodGroup"
                  defaultValue={medicalSummary?.bloodGroup ?? ""}
                  className="field tap-target"
                >
                  <option value="">{tVault("unknown")}</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="lbl">{tVault("allergiesLabel")}</span>
                <textarea
                  name="allergies"
                  rows={3}
                  defaultValue={medicalSummary?.allergies.join("\n")}
                  placeholder={tVault("oneItemPerLine")}
                  className="field"
                />
              </label>
              <label>
                <span className="lbl">{tVault("chronicConditionsLabel")}</span>
                <textarea
                  name="chronicConditions"
                  rows={3}
                  defaultValue={medicalSummary?.chronicConditions.join("\n")}
                  placeholder={tVault("oneItemPerLine")}
                  className="field"
                />
              </label>
              <label>
                <span className="lbl">{tVault("activeMedicationsLabel")}</span>
                <textarea
                  name="activeMedications"
                  rows={3}
                  defaultValue={medicalSummary?.activeMedications.join("\n")}
                  placeholder={tVault("oneItemPerLine")}
                  className="field"
                />
              </label>
              <button type="submit" className="btn sm tap-target self-start">
                {tVault("saveMedicalSummary")}
              </button>
            </form>
          </details>
        </div>
      )}

      {familyMembers.length > 0 && (
        <>
          <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
            {tPatient("familyMembersHeading")}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {familyMembers.map((member) => (
              <li key={member.familyMemberId}>
                <Link
                  href={`/clinic/${clinicSlug}/patients/${patientId}/family/${member.familyMemberId}`}
                  locale={locale as AppLocale}
                  className="card"
                >
                  <b className="disp font-semibold">{member.fullName}</b>
                  <p className="mono mt-1 text-xs" style={{ color: "#7a8a82" }}>
                    {t("lastVisitLabel")}: {formatClinicDate(member.lastVisit, locale)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {canViewClinical && (
        <>
          <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
            {t("recordsHeading")}
          </h2>
          <div className="slip mt-3">
            {records.length === 0 ? (
              <p style={{ color: "var(--color-ink-soft)" }}>{t("noRecordsLinked")}</p>
            ) : (
              records.map((record) => (
                <div key={record.id} className="qrow">
                  <div className="min-w-0">
                    <b>{record.fileName}</b>
                    <small>{tVault(`types.${record.recordType}` as "types.prescription_photo")}</small>
                  </div>
                  <form action={viewRecord}>
                    <input type="hidden" name="recordId" value={record.id} />
                    <button type="submit" className="btn gh sm tap-target">
                      {tVault("view")}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <h2 className="lbl mt-8" style={{ color: "var(--color-ink-soft)" }}>
        {t("appointmentHistoryHeading")}
      </h2>
      <div className="slip mt-3">
        {appointments.map((appt, i) => (
          <div key={appt.appointmentId} className="qrow">
            <span className="qn mono">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <b>{formatClinicDateTime(appt.scheduledStart, locale)}</b>
            </div>
            <span className={`qs${appt.status === "checked_in" || appt.status === "completed" ? " in" : ""}`}>
              {tPatient(`status.${appt.status}` as "status.booked")}
            </span>
            {canViewClinical && (appt.status === "checked_in" || appt.status === "completed") && (
              <Link
                href={`/clinic/${clinicSlug}/clinical-notes/${appt.appointmentId}`}
                locale={locale as AppLocale}
                className="btn gh sm tap-target"
                style={{ marginInlineStart: 10 }}
              >
                {t("viewClinicalNote")}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
