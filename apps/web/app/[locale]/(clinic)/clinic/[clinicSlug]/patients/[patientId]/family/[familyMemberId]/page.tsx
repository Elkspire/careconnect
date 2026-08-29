import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getClinicFamilyMemberDetail, listFamilyMemberRecords } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDateTime } from "@/lib/format-time";
import { viewClinicRecordAction } from "../../../../../../actions";

export default async function ClinicFamilyMemberDetailPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/patients/[patientId]/family/[familyMemberId]">,
) {
  const { locale, clinicSlug, patientId, familyMemberId } = await props.params;
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
  const canViewClinical = staffCtx.role === "owner" || staffCtx.role === "junior_doctor";

  const detail = await getClinicFamilyMemberDetail(clinicId, patientId, familyMemberId).catch(
    () => null,
  );
  if (!detail) {
    notFound();
  }
  const { familyMember, appointments } = detail;
  const records = canViewClinical ? await listFamilyMemberRecords(clinicId, patientId, familyMemberId) : [];
  const viewRecord = viewClinicRecordAction.bind(null, clinicId);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/clinic/${clinicSlug}/patients/${patientId}`}
        locale={locale as AppLocale}
        className="mono text-xs"
        style={{ color: "var(--color-verified)" }}
      >
        ← {familyMember.guardianFullName}
      </Link>

      <p className="kicker mt-4" style={{ color: "var(--color-verified)" }}>
        {t("familyMemberOfLabel", { name: familyMember.guardianFullName })}
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{familyMember.fullName}</h1>

      <div className="card mt-6">
        <div className="pgrid">
          <div className="prow">
            <span>{tPatient("relationshipLabel")}</span>
            <em>
              {tPatient(`relationship.${familyMember.relationship}` as "relationship.spouse")}
            </em>
          </div>
          <div className="prow">
            <span>{t("guardianLabel")}</span>
            <em>{familyMember.guardianFullName}</em>
          </div>
          <div className="prow">
            <span>{t("guardianPhoneLabel")}</span>
            <em>{familyMember.guardianPhone ?? "—"}</em>
          </div>
          {familyMember.gender && (
            <div className="prow">
              <span>{t("genderLabel")}</span>
              <em>{familyMember.gender}</em>
            </div>
          )}
          {familyMember.dob && (
            <div className="prow">
              <span>{t("dobLabel")}</span>
              <em>{familyMember.dob}</em>
            </div>
          )}
        </div>
      </div>

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
