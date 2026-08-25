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

  const staff = await listStaff(clinicId);
  const invite = inviteStaffAction.bind(null, locale, clinicSlug, clinicId);
  const revoke = revokeStaffAction.bind(null, locale, clinicSlug, clinicId);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <p className="kicker">CareConnect</p>
      <h1 className="disp mt-2 text-2xl font-bold text-paper">{t("staffHeading")}</h1>

      <div className="card mt-6">
        <div className="pgrid">
          {staff.map((member) => (
            <div key={member.id} className="prow">
              <span>
                {member.role} — {member.status}
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
            <span className="lbl">Full name</span>
            <input type="text" name="fullName" required className="field tap-target" />
          </label>
          <button type="submit" className="btn tap-target">
            {t("invite")}
          </button>
        </form>
      </div>
    </main>
  );
}
