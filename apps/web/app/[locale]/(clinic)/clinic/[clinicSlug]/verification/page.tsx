import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getMe, resolveClinicStaffBySlug } from "@/lib/api/me";
import { listMyVerificationDocuments } from "@/lib/api/verification";
import { formatClinicDate } from "@/lib/format-time";
import {
  deleteVerificationDocumentAction,
  uploadVerificationDocumentAction,
} from "../../../actions";

const DOCUMENT_TYPES = ["cnic", "degree", "council_registration", "other"] as const;

export default async function ClinicVerificationPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/verification">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, staffCtx, me] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
    getMe(),
  ]);
  if (!staffCtx) {
    notFound();
  }

  // Every practitioner has their own verification status independent of
  // any one clinic — owner and junior_doctor both qualify (both are
  // practitioners), receptionist/assistant aren't.
  if (!me.practitioner || (staffCtx.role !== "owner" && staffCtx.role !== "junior_doctor")) {
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

  const documents = await listMyVerificationDocuments();
  const upload = uploadVerificationDocumentAction.bind(null, locale, clinicSlug);
  const remove = deleteVerificationDocumentAction.bind(null, locale, clinicSlug);

  return (
    <div className="max-w-2xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("verificationHeading")}</h1>
      <p className="mt-2" style={{ color: "var(--color-ink-soft)" }}>
        {t("verificationScopeNote")}
      </p>
      <div className="trow mt-4">
        <span>{t("verificationStatusLabel")}</span>
        <em>{me.practitioner.verificationStatus}</em>
      </div>

      <div className="card mt-6">
        {documents.length === 0 ? (
          <p style={{ color: "var(--color-ink-soft)" }}>{t("noDocumentsYet")}</p>
        ) : (
          <div className="pgrid">
            {documents.map((doc) => (
              <div key={doc.id} className="prow">
                <span>
                  {t(`documentTypes.${doc.documentType}` as "documentTypes.cnic")} —{" "}
                  {doc.fileName}
                  <br />
                  <small style={{ color: "var(--color-ink-soft)" }}>
                    {formatClinicDate(doc.uploadedAt, locale)}
                  </small>
                </span>
                <form action={remove}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <button type="submit" className="qb tap-target">
                    {t("removeDocument")}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <form action={upload} className="slip mt-6 flex flex-wrap items-end gap-3">
        <label>
          <span className="lbl">{t("documentTypeLabel")}</span>
          <select name="documentType" className="field tap-target">
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {t(`documentTypes.${dt}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lbl">{t("fileLabel")}</span>
          <input
            type="file"
            name="file"
            required
            accept="application/pdf,image/jpeg,image/png"
            className="tap-target"
          />
        </label>
        <button type="submit" className="btn tap-target">
          {t("uploadDocument")}
        </button>
      </form>
    </div>
  );
}
