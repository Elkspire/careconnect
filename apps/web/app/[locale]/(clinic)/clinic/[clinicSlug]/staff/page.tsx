import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listStaff } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { inviteStaffAction, revokeStaffAction } from "../../../actions";

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

  const staff = await listStaff(clinicId);
  const invite = inviteStaffAction.bind(null, locale, clinicSlug, clinicId);
  const revoke = revokeStaffAction.bind(null, locale, clinicSlug, clinicId);

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
                {t(`roles.${member.role}` as "roles.owner")} — {member.status}
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

      <div className="slip mt-8">
        <p style={{ color: "var(--color-ink-soft)" }}>{t("invitePrompt")}</p>
        <form action={invite} className="mt-4 flex flex-wrap items-end gap-3">
          <label>
            <span className="lbl">{t("phoneLabel")}</span>
            <input
              type="tel"
              name="phone"
              required
              placeholder="+923001234567"
              className="field tap-target"
            />
          </label>
          <label>
            <span className="lbl">{t("fullNameLabel")}</span>
            <input type="text" name="fullName" required className="field tap-target" />
          </label>
          <label>
            <span className="lbl">{t("roleLabel")}</span>
            <select name="role" className="field tap-target">
              <option value="receptionist">{t("roles.receptionist")}</option>
              <option value="junior_doctor">{t("roles.junior_doctor")}</option>
            </select>
          </label>
          <button type="submit" className="btn tap-target">
            {t("invite")}
          </button>
        </form>
      </div>
    </div>
  );
}
