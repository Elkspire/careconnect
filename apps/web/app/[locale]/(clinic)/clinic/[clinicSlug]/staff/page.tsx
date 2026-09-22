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

export default async function ClinicStaffPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/staff">,
) {
  const { locale, clinicSlug } = await props.params;
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
        <div className="locked">
          <div className="lockmsg">
            <span className="mono">{t("accessDenied")}</span>
          </div>
        </div>
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
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("staffHeading")}</h1>

      <div className="card mt-6">
        <div className="pgrid">
          {staff.map((member) => (
            <div key={member.id} className="prow">
              <span>
                {member.fullName ?? member.phone ?? member.email} —{" "}
                {t(`roles.${member.role}` as "roles.owner")} — {member.status}
                {member.revokedPermissions.length > 0 && (
                  <>
                    <br />
                    <small style={{ color: "var(--color-ink-soft)" }}>
                      {t("customPermissionsNote", {
                        permissions: member.revokedPermissions
                          .map((p) => t(`permissions.${p}` as "permissions.viewPatientList"))
                          .join(", "),
                      })}
                    </small>
                  </>
                )}
              </span>
              {member.status === "active" && member.role !== "owner" && (
                <form action={revoke}>
                  <input type="hidden" name="staffId" value={member.id} />
                  <button type="submit" className="qb tap-target">
                    {t("revoke")}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6">
        <StaffPermissionMatrix />
      </div>

      <div className="slip mt-8">
        <p style={{ color: "var(--color-ink-soft)" }}>{t("invitePrompt")}</p>
        <form action={invite} className="mt-4 flex flex-wrap items-end gap-3">
          <label>
            <span className="lbl">{t("phoneLabel")}</span>
            <input
              type="tel"
              name="phone"
              placeholder="+923001234567"
              className="field tap-target"
            />
          </label>
          <label>
            <span className="lbl">{t("emailLabel")}</span>
            <input type="email" name="email" className="field tap-target" />
          </label>
          <label>
            <span className="lbl">{t("fullNameLabel")}</span>
            <input type="text" name="fullName" required className="field tap-target" />
          </label>
          <StaffInviteFields />
          <button type="submit" className="btn tap-target">
            {t("invite")}
          </button>
        </form>
      </div>

      <div className="slip mt-8">
        <h2 className="disp text-lg font-bold">{t("assignmentsHeading")}</h2>
        <p className="mt-1" style={{ color: "var(--color-ink-soft)" }}>
          {t("assignmentsPrompt")}
        </p>

        <div className="pgrid mt-4">
          {assignments.length === 0 && (
            <p style={{ color: "var(--color-ink-soft)" }}>{t("noAssignments")}</p>
          )}
          {assignments.map((a) => (
            <div key={a.id} className="prow">
              <span>
                {a.juniorDoctorFullName} —{" "}
                {a.familyMemberFullName
                  ? `${a.familyMemberFullName} (${t("familyMemberOfLabel", { name: a.patientFullName })})`
                  : a.patientFullName}
              </span>
              <form action={unassign}>
                <input type="hidden" name="assignmentId" value={a.id} />
                <button type="submit" className="qb tap-target">
                  {t("unassign")}
                </button>
              </form>
            </div>
          ))}
        </div>

        {activeJuniorDoctors.length === 0 ? (
          <p className="mt-4" style={{ color: "var(--color-ink-soft)" }}>
            {t("noJuniorDoctors")}
          </p>
        ) : (
          <form action={assign} className="mt-4 flex flex-wrap items-end gap-3">
            <label>
              <span className="lbl">{t("assignJuniorDoctorLabel")}</span>
              <select name="juniorDoctorUserId" required className="field tap-target">
                {activeJuniorDoctors.map((doc) => (
                  <option key={doc.userId} value={doc.userId}>
                    {doc.fullName ?? doc.phone ?? doc.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="lbl">{t("assignPatientLabel")}</span>
              <select name="subject" required className="field tap-target">
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
            </label>
            <button type="submit" className="btn tap-target">
              {t("assign")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
