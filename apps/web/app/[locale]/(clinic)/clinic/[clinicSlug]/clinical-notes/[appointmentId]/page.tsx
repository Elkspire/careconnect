import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getClinicalNote } from "@/lib/api/clinical";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { saveClinicalNoteAction } from "../../../../actions";

export default async function ClinicalNotePage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/clinical-notes/[appointmentId]">,
) {
  const { locale, clinicSlug, appointmentId } = await props.params;
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }
  const clinicId = staffCtx.clinicId;

  // Server-side role check — not just an absent nav link. The API already
  // enforces this (ClinicalController requires 'owner' via ClinicRoleGuard),
  // this is a second, independent check so the page itself never even
  // fetches clinical data for a non-owner. Matches the plan's requirement
  // that the clinical/receptionist boundary isn't UI hiding on either side.
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

  const note = await getClinicalNote(clinicId, appointmentId);
  const action = saveClinicalNoteAction.bind(
    null,
    locale,
    clinicSlug,
    clinicId,
    appointmentId,
    note !== null,
  );

  return (
    <div className="max-w-2xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("notesHeading")}</h1>

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
    </div>
  );
}
