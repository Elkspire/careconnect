import { getTranslations } from "next-intl/server";
import { listVaultRecords, type VaultRecord } from "@/lib/api/vault";
import { listFamilyMembers } from "@/lib/api/patients";
import { uploadVaultRecordAction, viewVaultRecordAction } from "../../actions";

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

export default async function VaultPage(props: PageProps<"/[locale]/patient/vault">) {
  const { locale } = await props.params;
  const [t, records, familyMembers] = await Promise.all([
    getTranslations("vault"),
    listVaultRecords(),
    listFamilyMembers(),
  ]);
  const upload = uploadVaultRecordAction.bind(null, locale);
  const view = viewVaultRecordAction.bind(null, locale);

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
    </div>
  );
}
