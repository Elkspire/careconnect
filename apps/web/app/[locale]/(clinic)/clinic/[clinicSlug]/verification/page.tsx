import { ShieldCheck, Upload } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getMe, resolveClinicStaffBySlug } from "@/lib/api/me";
import { listMyVerificationDocuments } from "@/lib/api/verification";
import { formatClinicDate } from "@/lib/format-time";
import {
  deleteVerificationDocumentAction,
  uploadVerificationDocumentAction,
} from "../../../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListRow } from "@/components/ui/list-row";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

const DOCUMENT_TYPES = ["cnic", "degree", "council_registration", "other"] as const;
const STATUS_TONE = { verified: "green", pending: "orange", unverified: "gray" } as const;

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
  // practitioners), receptionist isn't.
  if (!me.practitioner || (staffCtx.role !== "owner" && staffCtx.role !== "junior_doctor")) {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title={t("accessDenied")} />
      </div>
    );
  }

  const documents = await listMyVerificationDocuments();
  const upload = uploadVerificationDocumentAction.bind(null, locale, clinicSlug);
  const remove = deleteVerificationDocumentAction.bind(null, locale, clinicSlug);

  return (
    <div className="max-w-2xl">
      <PageHeader
        icon={ShieldCheck}
        kicker="CareConnect"
        title={t("verificationHeading")}
        description={t("verificationScopeNote")}
      />

      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-text-muted">{t("verificationStatusLabel")}:</span>
        <Badge tone={STATUS_TONE[me.practitioner.verificationStatus as keyof typeof STATUS_TONE] ?? "gray"}>
          {me.practitioner.verificationStatus}
        </Badge>
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("noDocumentsYet")} />
      ) : (
        <Card>
          {documents.map((doc) => (
            <ListRow
              key={doc.id}
              title={`${t(`documentTypes.${doc.documentType}` as "documentTypes.cnic")} — ${doc.fileName}`}
              subtitle={formatClinicDate(doc.uploadedAt, locale)}
              action={
                <form action={remove}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <SubmitButton
                    className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg"
                  >
                    {t("removeDocument")}
                  </SubmitButton>
                </form>
              }
            />
          ))}
        </Card>
      )}

      <Card padding="lg" className="mt-6">
        <form action={upload} className="flex flex-wrap items-end gap-3">
          <FormField label={t("documentTypeLabel")}>
            <select
              name="documentType"
              className="tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {t(`documentTypes.${dt}`)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("fileLabel")}>
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png"
              className="tap-target text-sm"
            />
          </FormField>
          <SubmitButton
            className="tap-target flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
          >
            <Upload aria-hidden className="size-4" />
            {t("uploadDocument")}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
