import { getTranslations } from "next-intl/server";
import { listVaultRecords } from "@/lib/api/vault";
import { uploadVaultRecordAction, viewVaultRecordAction } from "../../actions";

export default async function VaultPage(props: PageProps<"/[locale]/patient/vault">) {
  const { locale } = await props.params;
  const [t, records] = await Promise.all([getTranslations("vault"), listVaultRecords()]);
  const upload = uploadVaultRecordAction.bind(null, locale);
  const view = viewVaultRecordAction.bind(null, locale);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <p className="kicker">CareConnect</p>
      <h1 className="disp mt-2 text-2xl font-bold text-paper">{t("heading")}</h1>

      {records.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-cream-dim)" }}>
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
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
      )}

      <form action={upload} className="slip mt-8 flex flex-wrap items-end gap-3">
        <label>
          <span className="lbl">{t("recordTypeLabel")}</span>
          <select name="recordType" className="field tap-target">
            <option value="prescription_photo">{t("types.prescription_photo")}</option>
            <option value="lab_report">{t("types.lab_report")}</option>
            <option value="other_document">{t("types.other_document")}</option>
          </select>
        </label>
        <input type="hidden" name="subjectType" value="self" />
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
    </main>
  );
}
