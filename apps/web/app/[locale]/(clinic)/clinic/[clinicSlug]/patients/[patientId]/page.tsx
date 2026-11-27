import { ArrowLeft, FileText, User } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getClinicPatientDetail,
  getPatientMedicalSummary,
  listPatientRecords,
} from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListRow } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/empty-state";
import { upsertClinicMedicalSummaryAction, viewClinicRecordAction } from "../../../../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { MedicalSummaryModal } from "@/components/medical-summary-modal";
import { AuditNotice } from "@/components/audit-notice";
import { auditNoticeFrom, unlessRefused } from "@/lib/api/audit";

const secondaryButtonClasses =
  "tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700";

export default async function ClinicPatientDetailPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/patients/[patientId]">,
) {
  const { locale, clinicSlug, patientId } = await props.params;
  const notice = auditNoticeFrom((await props.searchParams).audit);
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
  const clinical = canViewClinical
    ? await unlessRefused(
        Promise.all([
          listPatientRecords(clinicId, patientId),
          getPatientMedicalSummary(clinicId, patientId),
        ]),
      )
    : null;
  const [records, medicalSummary] = clinical ?? [[], null];
  // The API couldn't record the access, so it showed us nothing.
  const refused = canViewClinical && !clinical;
  const viewRecord = viewClinicRecordAction.bind(
    null,
    clinicSlug,
    clinicId,
    patientId,
    undefined,
  );
  const saveSummary = upsertClinicMedicalSummaryAction.bind(null, locale, clinicSlug, clinicId, patientId);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/clinic/${clinicSlug}/patients`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("backToPatients")}
      </Link>

      <div className="mt-4">
        <PageHeader icon={User} kicker={t("patientsHeading")} title={patient.fullName} />
      </div>

      {notice === "saved" && <AuditNotice kind="saved" />}
      {(refused || notice === "refused") && <AuditNotice kind="refused" />}

      <Card className="-mt-2">
        <ListRow title={t("phoneLabel")} meta={patient.phone ?? "—"} />
        {patient.email && <ListRow title={t("emailLabel")} meta={patient.email} />}
        {patient.gender && <ListRow title={t("genderLabel")} meta={patient.gender} />}
        {patient.dob && <ListRow title={t("dobLabel")} meta={patient.dob} />}
      </Card>

      {clinical && (
        <Card padding="lg" className="mt-6">
          <b className="font-semibold text-text">{t("medicalSummaryHeading")}</b>
          {medicalSummary &&
          (medicalSummary.bloodGroup ||
            medicalSummary.allergies.length > 0 ||
            medicalSummary.chronicConditions.length > 0) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {medicalSummary.allergies.map((a) => (
                <Badge key={a} tone="red">
                  {a}
                </Badge>
              ))}
              {medicalSummary.chronicConditions.map((c) => (
                <Badge key={c} tone="orange">
                  {c}
                </Badge>
              ))}
              {medicalSummary.bloodGroup && <Badge tone="blue">{medicalSummary.bloodGroup}</Badge>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{tVault("noMedicalSummary")}</p>
          )}
          {medicalSummary && medicalSummary.activeMedications.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {tVault("activeMedicationsLabel")}
              </h4>
              <ul className="mt-1 flex flex-col gap-1">
                {medicalSummary.activeMedications.map((m) => (
                  <li key={m} className="text-sm text-text">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <MedicalSummaryModal
            summary={medicalSummary}
            action={saveSummary}
            subjectName={patient.fullName}
          />
        </Card>
      )}

      {familyMembers.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-base font-bold text-text">
            {tPatient("familyMembersHeading")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {familyMembers.map((member) => (
              <li key={member.familyMemberId}>
                <Link
                  href={`/clinic/${clinicSlug}/patients/${patientId}/family/${member.familyMemberId}`}
                  className="block h-full"
                >
                  <Card interactive>
                    <b className="font-semibold text-text">{member.fullName}</b>
                    <p className="mt-1 text-xs text-text-faint">
                      {t("lastVisitLabel")}: {formatClinicDate(member.lastVisit, locale)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {clinical && (
        <>
          <h2 className="mb-3 mt-8 text-base font-bold text-text">
            {t("recordsHeading")}
          </h2>
          {records.length === 0 ? (
            <EmptyState icon={FileText} title={t("noRecordsLinked")} />
          ) : (
            <Card>
              {records.map((record) => (
                <ListRow
                  key={record.id}
                  title={record.fileName}
                  subtitle={tVault(`types.${record.recordType}` as "types.prescription_photo")}
                  action={
                    <form action={viewRecord}>
                      <input type="hidden" name="recordId" value={record.id} />
                      <SubmitButton className={secondaryButtonClasses}>
                        {tVault("view")}
                      </SubmitButton>
                    </form>
                  }
                />
              ))}
            </Card>
          )}
        </>
      )}

      <h2 className="mb-3 mt-8 text-base font-bold text-text">
        {t("appointmentHistoryHeading")}
      </h2>
      <Card>
        {appointments.map((appt, i) => (
          <ListRow
            key={appt.appointmentId}
            title={
              <>
                <span className="me-2 text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                {formatClinicDateTime(appt.scheduledStart, locale)}
              </>
            }
            meta={
              <StatusBadge
                kind="appointment"
                status={appt.status}
                label={tPatient(`status.${appt.status}` as "status.booked")}
              />
            }
            action={
              canViewClinical &&
              (appt.status === "checked_in" || appt.status === "completed") && (
                <Link
                  href={`/clinic/${clinicSlug}/clinical-notes/${appt.appointmentId}`}
                  className={secondaryButtonClasses}
                >
                  {t("viewClinicalNote")}
                </Link>
              )
            }
          />
        ))}
      </Card>
    </div>
  );
}
