import { FileText, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSharedBundle } from "@/lib/api/shares";
import { formatClinicDate, formatClinicTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { ListRow } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/empty-state";

export default async function SharedRecordPage(
  props: PageProps<"/[locale]/s/[token]">,
) {
  const { locale, token } = await props.params;
  const [t, tVault, bundle] = await Promise.all([
    getTranslations("sharedRecord"),
    getTranslations("vault"),
    getSharedBundle(token),
  ]);

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Alert tone="danger" title={t("invalidHeading")} description={t("invalidBody")} />
      </main>
    );
  }

  const summary = bundle.medicalSummary;
  const hasFlags =
    !!summary &&
    (summary.bloodGroup || summary.allergies.length > 0 || summary.chronicConditions.length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <PageHeader
        icon={ShieldCheck}
        kicker="CareConnect"
        title={t("heading")}
        description={
          bundle.expiresAt
            ? t("expiresLabel", {
                date: `${formatClinicDate(bundle.expiresAt, locale)} ${formatClinicTime(bundle.expiresAt, locale)}`,
              })
            : t("neverExpiresLabel")
        }
      />
      <p className="-mt-4 mb-6 text-lg font-semibold text-text">{bundle.subjectFullName}</p>

      <Card padding="lg">
        {hasFlags ? (
          <div className="flex flex-wrap gap-2">
            {summary!.allergies.map((a) => (
              <Badge key={a} tone="red">
                {a}
              </Badge>
            ))}
            {summary!.chronicConditions.map((c) => (
              <Badge key={c} tone="orange">
                {c}
              </Badge>
            ))}
            {summary!.bloodGroup && <Badge tone="blue">{summary!.bloodGroup}</Badge>}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t("noMedicalSummary")}</p>
        )}
        {summary && summary.activeMedications.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("activeMedicationsLabel")}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {summary.activeMedications.map((m) => (
                <li key={m} className="text-sm text-text">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {bundle.scope.includeClinicalHistory && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("visitHistoryHeading")}
          </h2>
          {bundle.clinicalHistory.length === 0 ? (
            <p className="text-sm text-text-muted">{t("noVisitHistory")}</p>
          ) : (
            <Timeline>
              {bundle.clinicalHistory.map((entry) => (
                <TimelineItem
                  key={entry.appointmentId}
                  date={formatClinicDate(entry.scheduledStart, locale)}
                  title={
                    <>
                      {entry.practitionerFullName}
                      {entry.diagnosis ? ` — ${entry.diagnosis}` : ""}
                    </>
                  }
                >
                  <p>{entry.clinicName}</p>
                  {entry.notes && <p>{entry.notes}</p>}
                  {entry.prescriptionItems.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted p-3">
                      {entry.prescriptionItems.map((item, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                          <span>
                            <b className="font-semibold text-text">{item.drugName}</b>
                            {item.instructions && (
                              <span className="ms-1.5 text-text-muted">{item.instructions}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-text-muted">
                            {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </div>
      )}

      {(bundle.scope.includeLabReports || bundle.scope.includeOtherRecords) && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("recordsHeading")}
          </h2>
          {bundle.records.length === 0 ? (
            <EmptyState icon={FileText} title={t("noRecords")} />
          ) : (
            <Card>
              {bundle.records.map((record) => (
                <ListRow
                  key={record.id}
                  title={record.fileName}
                  subtitle={tVault(`types.${record.recordType}` as "types.prescription_photo")}
                  action={
                    record.url && (
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tap-target inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700"
                      >
                        {t("view")}
                      </a>
                    )
                  }
                />
              ))}
            </Card>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-text-faint">{t("footerNote")}</p>
    </main>
  );
}
