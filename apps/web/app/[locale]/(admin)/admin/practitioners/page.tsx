import { FileText, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listPendingPractitioners, listPractitionerDocuments } from "@/lib/api/admin";
import { formatClinicDate } from "@/lib/format-time";
import {
  rejectPractitionerAction,
  verifyPractitionerAction,
  viewVerificationDocumentAction,
} from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Drawer, Modal } from "@/components/ui/overlay";
import { FormField } from "@/components/ui/form-field";
import { ListRow } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function AdminPractitionersPage(
  props: PageProps<"/[locale]/admin/practitioners">,
) {
  const { locale } = await props.params;
  const t = await getTranslations("admin");
  const verify = verifyPractitionerAction.bind(null, locale);
  const reject = rejectPractitionerAction.bind(null, locale);

  const practitioners = await listPendingPractitioners().catch(() => null);

  if (practitioners === null) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <Alert tone="warning" title={t("accessDenied")} />
      </main>
    );
  }

  const documentsByPractitioner = new Map(
    await Promise.all(
      practitioners.map(
        async (p) => [p.id, await listPractitionerDocuments(p.id)] as const,
      ),
    ),
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        icon={ShieldCheck}
        kicker="CareConnect"
        title={t("heading")}
        description={t("scopeNote")}
      />

      {practitioners.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {practitioners.map((p) => (
            <li key={p.id}>
              <Card padding="lg">
                <b className="font-semibold text-text">{p.fullName}</b>
                <p className="text-sm text-text-muted">
                  {p.practitionerType} · {t("joinedLabel")} {formatClinicDate(p.createdAt, locale)}
                </p>
                <div className="mt-3 rounded-md border border-border">
                  <ListRow title={t("registrationNoLabel")} meta={p.councilRegistrationNo} />
                  <ListRow title={t("phoneLabel")} meta={p.phone ?? "—"} />
                  <ListRow title={t("statusLabel")} meta={
                      <StatusBadge
                        kind="verification"
                        status={p.verificationStatus}
                        label={t(`verificationStatus.${p.verificationStatus}` as "verificationStatus.pending")}
                      />
                    } />
                </div>
                {p.verificationNote && (
                  <p className="mt-2 text-sm text-danger-fg">
                    {t("lastNoteLabel")}: {p.verificationNote}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={verify}>
                    <input type="hidden" name="practitionerId" value={p.id} />
                    <SubmitButton
                      className="tap-target rounded-md bg-primary-700 px-3 py-1.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
                    >
                      {t("verify")}
                    </SubmitButton>
                  </form>
                  <div>
                    <Modal
                      trigger={t("reject")}
                      triggerVariant="danger"
                      title={t("rejectTitle", { name: p.fullName })}
                      description={t("rejectBody")}
                      formAction={reject}
                      submitLabel={t("confirmReject")}
                      submitTone="danger"
                    >
                      <input type="hidden" name="practitionerId" value={p.id} />
                      <FormField label={t("rejectReasonLabel")}>
                        <input type="text" name="reason" required className="tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600" />
                      </FormField>
                    </Modal>
                  </div>
                  <div>
                    <Drawer
                      trigger={
                        <>
                          <FileText aria-hidden className="size-4" />
                          {t("documentsLabel")} ({documentsByPractitioner.get(p.id)?.length ?? 0})
                        </>
                      }
                      title={t("documentsLabel")}
                      description={`${p.fullName} · ${p.councilRegistrationNo}`}
                    >
                      {(documentsByPractitioner.get(p.id)?.length ?? 0) === 0 ? (
                        <p className="text-sm text-text-muted">{t("noDocuments")}</p>
                      ) : (
                        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                          {documentsByPractitioner.get(p.id)!.map((doc) => (
                            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <span className="min-w-0">
                                <b className="block text-sm font-semibold text-text">
                                  {t(`documentTypes.${doc.documentType}` as "documentTypes.cnic")}
                                </b>
                                <span className="block truncate text-xs text-text-muted">{doc.fileName}</span>
                              </span>
                              <form action={viewVerificationDocumentAction}>
                                <input type="hidden" name="documentId" value={doc.id} />
                                <SubmitButton className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700">
                                  {t("view")}
                                </SubmitButton>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Drawer>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
