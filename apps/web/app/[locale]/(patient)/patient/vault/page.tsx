import { FolderHeart, Share2, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listVaultRecords, type VaultRecord } from "@/lib/api/vault";
import { listFamilyMembers, type FamilyMember } from "@/lib/api/patients";
import { listMyClinicalHistory, type MyClinicalHistoryEntry } from "@/lib/api/clinical";
import {
  getFamilyMemberMedicalSummary,
  getMyMedicalSummary,
  type MedicalSummary,
} from "@/lib/api/medical-summary";
import { listMyShares, type RecordShare } from "@/lib/api/shares";
import { formatClinicDate, formatClinicTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListRow } from "@/components/ui/list-row";
import { FormField } from "@/components/ui/form-field";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createShareAction,
  revokeShareAction,
  uploadScanAction,
  upsertMedicalSummaryAction,
  uploadVaultRecordAction,
  viewVaultRecordAction,
} from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { AuditNotice } from "@/components/audit-notice";
import { auditNoticeFrom } from "@/lib/api/audit";
import { DocumentScanner } from "@/components/document-scanner";
import { MedicalSummaryModal } from "@/components/medical-summary-modal";
import { Modal } from "@/components/ui/overlay";
import { StatusBadge } from "@/components/ui/status-badge";
import type { FormResult } from "@/lib/form-result";


const inputClasses =
  "tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600";
const secondaryButtonClasses =
  "tap-target rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:border-primary-500 hover:text-primary-700";

function RecordGroup({
  heading,
  records,
  t,
  view,
}: {
  heading: string;
  records: VaultRecord[];
  t: Awaited<ReturnType<typeof getTranslations<"vault">>>;
  view: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-base font-bold text-text">
        {heading}
      </h2>
      <Card>
        {records.map((record) => (
          <ListRow
            key={record.id}
            title={record.fileName}
            subtitle={t(`types.${record.recordType}` as "types.prescription_photo")}
            action={
              <form action={view}>
                <input type="hidden" name="recordId" value={record.id} />
                <SubmitButton className={secondaryButtonClasses}>
                  {t("view")}
                </SubmitButton>
              </form>
            }
          />
        ))}
      </Card>
    </div>
  );
}

function MedicalSummaryCard({
  heading,
  summary,
  familyMemberId,
  t,
  save,
}: {
  heading: string;
  summary: MedicalSummary | null;
  familyMemberId?: string;
  t: Awaited<ReturnType<typeof getTranslations<"vault">>>;
  save: (formData: FormData) => Promise<FormResult>;
}) {
  const hasFlags =
    !!summary &&
    (summary.bloodGroup ||
      summary.allergies.length > 0 ||
      summary.chronicConditions.length > 0);

  return (
    <Card padding="lg" className="mt-6">
      <b className="font-semibold text-text">{heading}</b>

      {hasFlags ? (
        <div className="mt-3 flex flex-wrap gap-2">
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
        <p className="mt-2 text-sm text-text-muted">{t("noMedicalSummary")}</p>
      )}

      {summary && summary.activeMedications.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("activeMedicationsLabel")}
          </h4>
          <ul className="mt-1 flex flex-col gap-1">
            {summary.activeMedications.map((m) => (
              <li key={m} className="text-sm text-text">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MedicalSummaryModal
        summary={summary}
        action={save}
        familyMemberId={familyMemberId}
        subjectName={heading}
      />
    </Card>
  );
}

function HistorySection({
  entries,
  t,
  locale,
}: {
  entries: MyClinicalHistoryEntry[];
  t: Awaited<ReturnType<typeof getTranslations<"vault">>>;
  locale: string;
}) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-base font-bold text-text">
        {t("visitHistoryHeading")}
      </h2>
      <Timeline>
        {entries.map((entry) => (
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
            <p>
              {entry.clinicName}
              {entry.subjectType === "family_member" && entry.familyMemberFullName
                ? ` · ${entry.familyMemberFullName}`
                : ""}
            </p>
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
    </div>
  );
}

/**
 * A plain helper, not a component or hook, so the impure Date.now() call
 * it makes isn't subject to the react-hooks/purity rule the way it would
 * be inline in ShareSection's render body below.
 */
function shareStatus(share: RecordShare): "revoked" | "expired" | "active" {
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

function ShareSection({
  shares,
  familyMembers,
  locale,
  t,
  create,
  revoke,
}: {
  shares: RecordShare[];
  familyMembers: FamilyMember[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"vault">>>;
  create: (formData: FormData) => Promise<FormResult>;
  revoke: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-text">{t("shareHeading")}</h2>
        <div>
          <Modal
            trigger={
              <>
                <Share2 aria-hidden className="size-4" />
                {t("createShare")}
              </>
            }
            triggerVariant="primary"
            title={t("createShare")}
            formAction={create}
            submitLabel={t("createShare")}
          >
            <div className="flex flex-col gap-3">
              {familyMembers.length > 0 && (
                <FormField label={t("shareSubjectLabel")}>
                  <select name="familyMemberId" className={inputClasses}>
                    <option value="">{t("forSelf")}</option>
                    {familyMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  name="includeClinicalHistory"
                  defaultChecked
                  className="size-4 accent-primary-600"
                />
                <span className="text-sm text-text">
                  {t("shareIncludeClinicalHistory")}
                  <small className="block text-xs text-text-muted">
                    {t("shareIncludeClinicalHistoryHint")}
                  </small>
                </span>
              </label>
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  name="includeLabReports"
                  defaultChecked
                  className="size-4 accent-primary-600"
                />
                <span className="text-sm text-text">{t("shareIncludeLabReports")}</span>
              </label>
              <label className="flex items-center gap-3 py-1">
                <input type="checkbox" name="includeOtherRecords" className="size-4 accent-primary-600" />
                <span className="text-sm text-text">
                  {t("shareIncludeOtherRecords")}
                  <small className="block text-xs text-text-muted">
                    {t("shareIncludeOtherRecordsHint")}
                  </small>
                </span>
              </label>
              <FormField label={t("shareDurationLabel")}>
                <select name="duration" defaultValue="7d" className={inputClasses}>
                  <option value="24h">{t("duration24h")}</option>
                  <option value="7d">{t("duration7d")}</option>
                  <option value="forever">{t("durationForever")}</option>
                </select>
              </FormField>
            </div>
          </Modal>
        </div>
      </div>

      {shares.length === 0 ? (
        <EmptyState icon={Share2} title={t("noShares")} />
      ) : (
        <Card>
          {shares.map((s) => {
            const status = shareStatus(s);
            const shareUrl = `/s/${s.token}`;
            return (
              <ListRow
                key={s.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {s.familyMemberFullName ?? t("forSelf")}
                    <StatusBadge
                      kind="share"
                      status={status}
                      label={
                        status === "revoked"
                          ? t("shareRevoked")
                          : status === "expired"
                            ? t("shareExpired")
                            : t("shareActive")
                      }
                    />
                  </span>
                }
                subtitle={
                  <>
                    {status === "active" && (
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-primary-700 hover:text-primary-800"
                      >
                        {shareUrl}
                      </a>
                    )}
                    <span>
                      {status === "active" &&
                        (s.expiresAt
                          ? t("shareExpiresLabel", {
                              date: `${formatClinicDate(s.expiresAt, locale)} ${formatClinicTime(s.expiresAt, locale)}`,
                            })
                          : t("shareNeverExpires"))}
                      {status === "active" && " · "}
                      {t("shareOpenedCount", { count: s.accessCount })}
                    </span>
                  </>
                }
                action={
                  status !== "revoked" && (
                    <form action={revoke}>
                      <input type="hidden" name="shareId" value={s.id} />
                      <SubmitButton className={secondaryButtonClasses}>
                        {t("revokeShare")}
                      </SubmitButton>
                    </form>
                  )
                }
              />
            );
          })}
        </Card>
      )}

    </div>
  );
}

export default async function VaultPage(props: PageProps<"/[locale]/patient/vault">) {
  const { locale } = await props.params;
  const notice = auditNoticeFrom((await props.searchParams).audit);
  const [t, records, familyMembers, myMedicalSummary, history, shares] = await Promise.all([
    getTranslations("vault"),
    listVaultRecords(),
    listFamilyMembers(),
    getMyMedicalSummary(),
    listMyClinicalHistory(),
    listMyShares(),
  ]);
  const familyMedicalSummaries = await Promise.all(
    familyMembers.map((m) => getFamilyMemberMedicalSummary(m.id)),
  );
  const medicalSummaryByFamilyMemberId = new Map<string, MedicalSummary | null>(
    familyMembers.map((m: FamilyMember, i: number) => [m.id, familyMedicalSummaries[i] ?? null]),
  );

  const upload = uploadVaultRecordAction.bind(null, locale);
  const uploadScan = uploadScanAction.bind(null, locale);
  const view = viewVaultRecordAction.bind(null, locale);
  const saveSummary = upsertMedicalSummaryAction.bind(null, locale);
  const createShareBound = createShareAction.bind(null, locale);
  const revokeShareBound = revokeShareAction.bind(null, locale);

  // Each family member's records are kept visually separate rather than
  // mixed into one list — the whole point of tagging records by subject.
  const selfRecords = records.filter((r) => r.subjectType === "self");
  const familyRecordsByMemberId = new Map<string, VaultRecord[]>();
  for (const record of records) {
    if (record.subjectType === "family_member" && record.familyMemberId) {
      const list = familyRecordsByMemberId.get(record.familyMemberId) ?? [];
      list.push(record);
      familyRecordsByMemberId.set(record.familyMemberId, list);
    }
  }

  return (
    <div>
      <PageHeader icon={FolderHeart} kicker="CareConnect" title={t("heading")} />

      {notice && <AuditNotice kind={notice} />}

      <MedicalSummaryCard
        heading={t("forSelf")}
        summary={myMedicalSummary}
        t={t}
        save={saveSummary}
      />
      {familyMembers.map((member) => (
        <MedicalSummaryCard
          key={member.id}
          heading={member.fullName}
          summary={medicalSummaryByFamilyMemberId.get(member.id) ?? null}
          familyMemberId={member.id}
          t={t}
          save={saveSummary}
        />
      ))}

      {records.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={FolderHeart} title={t("empty")} />
        </div>
      ) : (
        <>
          {selfRecords.length > 0 && (
            <RecordGroup heading={t("forSelf")} records={selfRecords} t={t} view={view} />
          )}
          {familyMembers.map((member) => {
            const memberRecords = familyRecordsByMemberId.get(member.id);
            return memberRecords ? (
              <RecordGroup
                key={member.id}
                heading={member.fullName}
                records={memberRecords}
                t={t}
                view={view}
              />
            ) : null;
          })}
        </>
      )}

      <Card padding="lg" className="mt-8 max-w-2xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-text">{t("addRecordHeading")}</h2>
            <p className="mt-1 text-sm text-text-muted">{t("addRecordHint")}</p>
          </div>
          <div className="shrink-0">
            <DocumentScanner
              familyMembers={familyMembers.map((m) => ({ id: m.id, fullName: m.fullName }))}
              uploadAction={uploadScan}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-3 border-t border-border pt-5">
          <div>
            <Modal
              trigger={
                <>
                  <Upload aria-hidden className="size-4" />
                  {t("upload")}
                </>
              }
              title={t("addRecordHeading")}
              formAction={upload}
              submitLabel={t("upload")}
            >
              <div className="flex flex-col gap-4">
                <FormField label={t("recordTypeLabel")}>
                  <select name="recordType" className={inputClasses}>
                    <option value="prescription_photo">{t("types.prescription_photo")}</option>
                    <option value="lab_report">{t("types.lab_report")}</option>
                    <option value="other_document">{t("types.other_document")}</option>
                  </select>
                </FormField>
                {familyMembers.length > 0 && (
                  <FormField label={t("familyMemberLabel")}>
                    <select name="familyMemberId" className={inputClasses}>
                      <option value="">{t("forSelf")}</option>
                      {familyMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}
                <FormField label={t("fileLabel")}>
                  <input
                    type="file"
                    name="file"
                    required
                    accept="application/pdf,image/jpeg,image/png,image/heic"
                    className="tap-target text-sm"
                  />
                </FormField>
              </div>
            </Modal>
          </div>
        </div>
      </Card>

      {history.length > 0 && <HistorySection entries={history} t={t} locale={locale} />}

      <ShareSection
        shares={shares}
        familyMembers={familyMembers}
        locale={locale}
        t={t}
        create={createShareBound}
        revoke={revokeShareBound}
      />
    </div>
  );
}
