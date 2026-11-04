import { ArrowLeft, ChevronDown, FileText, User } from "lucide-react";
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
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { upsertClinicMedicalSummaryAction, viewClinicRecordAction } from "../../../../actions";
import { SubmitButton } from "@/components/ui/submit-button";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const inputClasses =
  "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const secondaryButtonClasses =
  "tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700";

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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("backToPatients")}
      </Link>

      <div className="mt-4">
        <PageHeader icon={User} kicker={t("patientsHeading")} title={patient.fullName} />
      </div>

      <Card className="-mt-2">
        <ListRow title={t("phoneLabel")} meta={patient.phone ?? "—"} />
        {patient.email && <ListRow title={t("emailLabel")} meta={patient.email} />}
        {patient.gender && <ListRow title={t("genderLabel")} meta={patient.gender} />}
        {patient.dob && <ListRow title={t("dobLabel")} meta={patient.dob} />}
      </Card>

      {canViewClinical && (
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

          <details className="group mt-4">
            <summary className="tap-target flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-semibold text-primary-700">
              {tVault("editMedicalSummary")}
              <ChevronDown aria-hidden className="size-3.5 transition group-open:rotate-180" />
            </summary>
            <form action={saveSummary} className="mt-3 flex flex-col gap-3">
              <FormField label={tVault("bloodGroupLabel")}>
                <select
                  name="bloodGroup"
                  defaultValue={medicalSummary?.bloodGroup ?? ""}
                  className={inputClasses}
                >
                  <option value="">{tVault("unknown")}</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={tVault("allergiesLabel")}>
                <textarea
                  name="allergies"
                  rows={3}
                  defaultValue={medicalSummary?.allergies.join("\n")}
                  placeholder={tVault("oneItemPerLine")}
                  className={inputClasses}
                />
              </FormField>
              <FormField label={tVault("chronicConditionsLabel")}>
                <textarea
                  name="chronicConditions"
                  rows={3}
                  defaultValue={medicalSummary?.chronicConditions.join("\n")}
                  placeholder={tVault("oneItemPerLine")}
                  className={inputClasses}
                />
              </FormField>
              <FormField label={tVault("activeMedicationsLabel")}>
                <textarea
                  name="activeMedications"
                  rows={3}
                  defaultValue={medicalSummary?.activeMedications.join("\n")}
                  placeholder={tVault("oneItemPerLine")}
                  className={inputClasses}
                />
              </FormField>
              <SubmitButton
                className="tap-target self-start rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
              >
                {tVault("saveMedicalSummary")}
              </SubmitButton>
            </form>
          </details>
        </Card>
      )}

      {familyMembers.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
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

      {canViewClinical && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
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

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
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
              <Badge tone={appt.status === "checked_in" || appt.status === "completed" ? "green" : "gray"}>
                {tPatient(`status.${appt.status}` as "status.booked")}
              </Badge>
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
