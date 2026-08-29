import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getClinicPatientDetail, listPatientRecords } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format-time";
import { viewClinicRecordAction } from "../../../../actions";

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
  const records = canViewClinical ? await listPatientRecords(clinicId, patientId) : [];
  const viewRecord = viewClinicRecordAction.bind(null, clinicId);

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
