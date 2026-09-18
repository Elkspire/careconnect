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
import {
  createShareAction,
  revokeShareAction,
  upsertMedicalSummaryAction,
  uploadVaultRecordAction,
  viewVaultRecordAction,
} from "../../actions";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

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
      <h2 className="lbl" style={{ color: "var(--color-ink-soft)" }}>
        {heading}
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {records.map((record) => (
          <li key={record.id} className="vslip flex items-center justify-between">
            <div>
              <b className="disp font-semibold">{record.fileName}</b>
              <small className="mono">
                {t(`types.${record.recordType}` as "types.prescription_photo")}
              </small>
            </div>
            <form action={view}>
              <input type="hidden" name="recordId" value={record.id} />
              <button type="submit" className="btn gh sm tap-target">
                {t("view")}
              </button>
            </form>
          </li>
        ))}
      </ul>
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
  save: (formData: FormData) => Promise<void>;
}) {
  const hasFlags =
    !!summary &&
    (summary.bloodGroup ||
      summary.allergies.length > 0 ||
      summary.chronicConditions.length > 0);

  return (
    <div className="chart mt-6">
      <div className="cn">
        <b>{heading}</b>
      </div>

      {hasFlags ? (
        <div className="flagrow">
          {summary!.allergies.map((a) => (
            <span key={a} className="flag mono">
              {a}
            </span>
          ))}
          {summary!.chronicConditions.map((c) => (
            <span key={c} className="flag mono">
              {c}
            </span>
          ))}
          {summary!.bloodGroup && <span className="flag n mono">{summary!.bloodGroup}</span>}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
          {t("noMedicalSummary")}
        </p>
      )}

      {summary && summary.activeMedications.length > 0 && (
        <>
          <h4 className="lbl mt-3">{t("activeMedicationsLabel")}</h4>
          <ul className="mt-1 grid gap-1">
            {summary.activeMedications.map((m) => (
              <li key={m} className="text-sm">
                {m}
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-3">
        <summary className="mono text-xs tap-target" style={{ color: "var(--color-verified)" }}>
          {t("editMedicalSummary")}
        </summary>
        <form action={save} className="mt-3 flex flex-col gap-3">
          {familyMemberId && (
            <input type="hidden" name="familyMemberId" value={familyMemberId} />
          )}
          <label>
            <span className="lbl">{t("bloodGroupLabel")}</span>
            <select
              name="bloodGroup"
              defaultValue={summary?.bloodGroup ?? ""}
              className="field tap-target"
            >
              <option value="">{t("unknown")}</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">{t("allergiesLabel")}</span>
            <textarea
              name="allergies"
              rows={3}
              defaultValue={summary?.allergies.join("\n")}
              placeholder={t("oneItemPerLine")}
              className="field"
            />
          </label>
          <label>
            <span className="lbl">{t("chronicConditionsLabel")}</span>
            <textarea
              name="chronicConditions"
              rows={3}
              defaultValue={summary?.chronicConditions.join("\n")}
              placeholder={t("oneItemPerLine")}
              className="field"
            />
          </label>
          <label>
            <span className="lbl">{t("activeMedicationsLabel")}</span>
            <textarea
              name="activeMedications"
              rows={3}
              defaultValue={summary?.activeMedications.join("\n")}
              placeholder={t("oneItemPerLine")}
              className="field"
            />
          </label>
          <button type="submit" className="btn sm tap-target self-start">
            {t("saveMedicalSummary")}
          </button>
        </form>
      </details>
    </div>
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
      <h2 className="lbl" style={{ color: "var(--color-ink-soft)" }}>
        {t("visitHistoryHeading")}
      </h2>
      <div className="tl mt-3">
        {entries.map((entry) => (
          <div key={entry.appointmentId} className="tli">
            <span className="td">{formatClinicDate(entry.scheduledStart, locale)}</span>
            <div>
              <b className="disp font-semibold">
                {entry.practitionerFullName}
                {entry.diagnosis ? ` — ${entry.diagnosis}` : ""}
              </b>
              <small>
                {entry.clinicName}
                {entry.subjectType === "family_member" && entry.familyMemberFullName
                  ? ` · ${entry.familyMemberFullName}`
                  : ""}
              </small>
              <small>{entry.notes}</small>
              {entry.prescriptionItems.length > 0 && (
                <div className="rx mt-2">
                  {entry.prescriptionItems.map((item, i) => (
                    <div key={i} className="rxline">
                      <div>
                        <b>{item.drugName}</b>
                        {item.instructions && <small>{item.instructions}</small>}
                      </div>
                      <span className="rxmeta">
                        {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
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
  create: (formData: FormData) => Promise<void>;
  revoke: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mt-8">
      <h2 className="lbl" style={{ color: "var(--color-ink-soft)" }}>
        {t("shareHeading")}
      </h2>

      <div className="pgrid mt-3">
        {shares.length === 0 ? (
          <p style={{ color: "var(--color-ink-soft)" }}>{t("noShares")}</p>
        ) : (
          shares.map((s) => {
            const status = shareStatus(s);
            const shareUrl = `/${locale}/s/${s.token}`;
            return (
              <div key={s.id} className="prow">
                <div className="min-w-0">
                  <b>{s.familyMemberFullName ?? t("forSelf")}</b>
                  {status === "active" && (
                    <>
                      <br />
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-sm"
                        style={{ color: "var(--color-verified)" }}
                      >
                        {shareUrl}
                      </a>
                    </>
                  )}
                  <br />
                  <small>
                    {status === "revoked"
                      ? t("shareRevoked")
                      : status === "expired"
                        ? t("shareExpired")
                        : s.expiresAt
                          ? t("shareExpiresLabel", {
                              date: `${formatClinicDate(s.expiresAt, locale)} ${formatClinicTime(s.expiresAt, locale)}`,
                            })
                          : t("shareNeverExpires")}
                    {" · "}
                    {t("shareOpenedCount", { count: s.accessCount })}
                  </small>
                </div>
                {status !== "revoked" && (
                  <form action={revoke}>
                    <input type="hidden" name="shareId" value={s.id} />
                    <button type="submit" className="qb tap-target">
                      {t("revokeShare")}
                    </button>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>

      <form action={create} className="slip mt-4 flex max-w-xl flex-col gap-3">
        {familyMembers.length > 0 && (
          <label>
            <span className="lbl">{t("shareSubjectLabel")}</span>
            <select name="familyMemberId" className="field tap-target">
              <option value="">{t("forSelf")}</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="trow items-center">
          <span>
            {t("shareIncludeClinicalHistory")}
            <small>{t("shareIncludeClinicalHistoryHint")}</small>
          </span>
          <input type="checkbox" name="includeClinicalHistory" defaultChecked />
        </label>
        <label className="trow items-center">
          <span>{t("shareIncludeLabReports")}</span>
          <input type="checkbox" name="includeLabReports" defaultChecked />
        </label>
        <label className="trow items-center">
          <span>
            {t("shareIncludeOtherRecords")}
            <small>{t("shareIncludeOtherRecordsHint")}</small>
          </span>
          <input type="checkbox" name="includeOtherRecords" />
        </label>
        <label>
          <span className="lbl">{t("shareDurationLabel")}</span>
          <select name="duration" defaultValue="7d" className="field tap-target">
            <option value="24h">{t("duration24h")}</option>
            <option value="7d">{t("duration7d")}</option>
            <option value="forever">{t("durationForever")}</option>
          </select>
        </label>
        <button type="submit" className="btn tap-target self-start">
          {t("createShare")}
        </button>
      </form>
    </div>
  );
}

export default async function VaultPage(props: PageProps<"/[locale]/patient/vault">) {
  const { locale } = await props.params;
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
    <div className="max-w-6xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("heading")}</h1>

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
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("empty")}
        </p>
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

      <form action={upload} className="slip mt-8 flex max-w-2xl flex-wrap items-end gap-3">
        <label>
          <span className="lbl">{t("recordTypeLabel")}</span>
          <select name="recordType" className="field tap-target">
            <option value="prescription_photo">{t("types.prescription_photo")}</option>
            <option value="lab_report">{t("types.lab_report")}</option>
            <option value="other_document">{t("types.other_document")}</option>
          </select>
        </label>
        {familyMembers.length > 0 && (
          <label>
            <span className="lbl">{t("familyMemberLabel")}</span>
            <select name="familyMemberId" className="field tap-target">
              <option value="">{t("forSelf")}</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="lbl">{t("fileLabel")}</span>
          <input
            type="file"
            name="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/heic"
            className="tap-target"
          />
        </label>
        <button type="submit" className="btn tap-target">
          {t("upload")}
        </button>
      </form>

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
