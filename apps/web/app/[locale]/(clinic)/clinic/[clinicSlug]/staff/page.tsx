import { UserCog } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listClinicPatients, listPatientAssignments, listStaff } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import {
  assignPatientAction,
  inviteStaffAction,
  revokeStaffAction,
  unassignPatientAction,
} from "../../../actions";
import { StaffPermissionMatrix } from "@/components/staff-permission-matrix";
import { StaffInviteFields } from "@/components/staff-invite-fields";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

const inputClasses =
  "tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600";
const secondaryButtonClasses =
  "tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg";
const primaryButtonClasses =
  "tap-target self-start rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800";

export default async function ClinicStaffPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/staff">,
) {
  const { locale, clinicSlug } = await props.params;
  const sp = await props.searchParams;
  const inviteError = typeof sp.inviteError === "string" ? sp.inviteError : undefined;
  const invited = sp.invited === "1";
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }
  const clinicId = staffCtx.clinicId;

  // Staff management is owner-only — the API already enforces this
  // (ClinicController requires 'owner' on every /staff route), this is a
  // second, independent check so a receptionist/junior doctor's page never
  // even attempts the now-403'd fetch. Same pattern as clinical-notes.
  if (staffCtx.role !== "owner") {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title={t("accessDenied")} />
      </div>
    );
  }

  const [staff, patients, assignments] = await Promise.all([
    listStaff(clinicId),
    listClinicPatients(clinicId),
    listPatientAssignments(clinicId),
  ]);
  const invite = inviteStaffAction.bind(null, locale, clinicSlug, clinicId);
  const revoke = revokeStaffAction.bind(null, locale, clinicSlug, clinicId);
  const assign = assignPatientAction.bind(null, locale, clinicSlug, clinicId);
  const unassign = unassignPatientAction.bind(null, locale, clinicSlug, clinicId);
  const activeJuniorDoctors = staff.filter(
    (member) => member.role === "junior_doctor" && member.status === "active",
  );

  return (
    <div className="max-w-2xl">
      <PageHeader icon={UserCog} kicker="CareConnect" title={t("staffHeading")} />

      <Card>
        {staff.map((member) => (
          <ListRow
            key={member.id}
            title={member.fullName ?? member.phone ?? member.email}
            subtitle={
              <>
                {t(`roles.${member.role}` as "roles.owner")} — {member.status}
                {member.revokedPermissions.length > 0 && (
                  <span className="mt-0.5 block text-xs text-text-faint">
                    {t("customPermissionsNote", {
                      permissions: member.revokedPermissions
                        .map((p) => t(`permissions.${p}` as "permissions.viewPatientList"))
                        .join(", "),
                    })}
                  </span>
                )}
              </>
            }
            action={
              member.status === "active" &&
              member.role !== "owner" && (
                <form action={revoke}>
                  <input type="hidden" name="staffId" value={member.id} />
                  <SubmitButton className={secondaryButtonClasses}>
                    {t("revoke")}
                  </SubmitButton>
                </form>
              )
            }
          />
        ))}
      </Card>

      <Card padding="lg" className="mt-6">
        <StaffPermissionMatrix />
      </Card>

      <Card padding="lg" className="mt-8">
        <p className="text-sm text-text-muted">{t("invitePrompt")}</p>
        {invited && (
          <div className="mt-3">
            <Alert tone="success" title={t("inviteSuccess")} />
          </div>
        )}
        {inviteError && (
          <div className="mt-3">
            <Alert tone="danger" title={inviteError} />
          </div>
        )}
        <form action={invite} className="mt-4 flex flex-wrap items-end gap-3">
          <FormField label={t("phoneLabel")}>
            <input
              type="tel"
              name="phone"
              required
              placeholder="0300 1234567"
              className={inputClasses}
            />
          </FormField>
          <FormField label={t("fullNameLabel")}>
            <input type="text" name="fullName" required className={inputClasses} />
          </FormField>
          <StaffInviteFields />
          <SubmitButton className={primaryButtonClasses}>
            {t("invite")}
          </SubmitButton>
        </form>
      </Card>

      <Card padding="lg" className="mt-8">
        <h2 className="text-lg font-bold text-text">{t("assignmentsHeading")}</h2>
        <p className="mt-1 text-sm text-text-muted">{t("assignmentsPrompt")}</p>

        <div className="mt-4">
          {assignments.length === 0 ? (
            <EmptyState icon={UserCog} title={t("noAssignments")} />
          ) : (
            <div className="rounded-md border border-border">
              {assignments.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.juniorDoctorFullName}
                  subtitle={
                    a.familyMemberFullName
                      ? `${a.familyMemberFullName} (${t("familyMemberOfLabel", { name: a.patientFullName })})`
                      : a.patientFullName
                  }
                  action={
                    <form action={unassign}>
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <SubmitButton className={secondaryButtonClasses}>
                        {t("unassign")}
                      </SubmitButton>
                    </form>
                  }
                />
              ))}
            </div>
          )}
        </div>

        {activeJuniorDoctors.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">{t("noJuniorDoctors")}</p>
        ) : (
          <form action={assign} className="mt-4 flex flex-wrap items-end gap-3">
            <FormField label={t("assignJuniorDoctorLabel")}>
              <select name="juniorDoctorUserId" required className={inputClasses}>
                {activeJuniorDoctors.map((doc) => (
                  <option key={doc.userId} value={doc.userId}>
                    {doc.fullName ?? doc.phone ?? doc.email}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t("assignPatientLabel")}>
              <select name="subject" required className={inputClasses}>
                {patients.map((p) => (
                  <option
                    key={`${p.patientId}:${p.familyMemberId ?? ""}`}
                    value={`${p.patientId}:${p.familyMemberId ?? ""}`}
                  >
                    {p.familyMemberId
                      ? `${p.fullName} (${t("familyMemberOfLabel", { name: p.guardianFullName ?? "" })})`
                      : p.fullName}
                  </option>
                ))}
              </select>
            </FormField>
            <SubmitButton className={primaryButtonClasses}>
              {t("assign")}
            </SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
