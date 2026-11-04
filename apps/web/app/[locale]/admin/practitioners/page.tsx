import { ChevronDown, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPendingPractitioners, listPractitionerDocuments } from "@/lib/api/admin";
import { formatClinicDate } from "@/lib/format-time";
import {
  rejectPractitionerAction,
  verifyPractitionerAction,
  viewVerificationDocumentAction,
} from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <nav className="mb-4 flex gap-2">
        <span className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white">
          {t("navPractitioners")}
        </span>
        <Link
          href="/admin/reviews"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition hover:bg-surface-muted hover:text-text"
        >
          {t("navReviews")}
        </Link>
      </nav>
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
                  <ListRow title={t("statusLabel")} meta={<Badge tone="orange">{p.verificationStatus}</Badge>} />
                </div>
                {p.verificationNote && (
                  <p className="mt-2 text-sm text-danger-fg">
                    {t("lastNoteLabel")}: {p.verificationNote}
                  </p>
                )}

                <div className="mt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t("documentsLabel")}
                  </span>
                  {(documentsByPractitioner.get(p.id)?.length ?? 0) === 0 ? (
                    <p className="text-sm text-text-muted">{t("noDocuments")}</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {documentsByPractitioner.get(p.id)!.map((doc) => (
                        <li key={doc.id}>
                          <form action={viewVerificationDocumentAction} className="inline">
                            <input type="hidden" name="documentId" value={doc.id} />
                            <SubmitButton
                              className="tap-target text-xs font-medium text-primary-700 hover:text-primary-800"
                            >
                              {t(`documentTypes.${doc.documentType}` as "documentTypes.cnic")} —{" "}
                              {doc.fileName}
                            </SubmitButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={verify}>
                    <input type="hidden" name="practitionerId" value={p.id} />
                    <SubmitButton
                      className="tap-target rounded-md bg-primary-700 px-3 py-1.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
                    >
                      {t("verify")}
                    </SubmitButton>
                  </form>
                  <details className="group">
                    <summary className="tap-target flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-semibold text-danger-fg">
                      {t("reject")}
                      <ChevronDown aria-hidden className="size-3.5 transition group-open:rotate-180" />
                    </summary>
                    <form action={reject} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="practitionerId" value={p.id} />
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {t("rejectReasonLabel")}
                        </span>
                        <input
                          type="text"
                          name="reason"
                          required
                          className="tap-target rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </label>
                      <SubmitButton
                        className="tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-danger-fg hover:text-danger-fg"
                      >
                        {t("confirmReject")}
                      </SubmitButton>
                    </form>
                  </details>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
