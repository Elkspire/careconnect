import { getTranslations } from "next-intl/server";
import { getSharedBundle } from "@/lib/api/shares";
import { formatClinicDate, formatClinicTime } from "@/lib/format-time";

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
        <div className="locked">
          <div className="lockmsg">
            <span className="mono">{t("invalidHeading")}</span>
          </div>
        </div>
        <p className="mt-3" style={{ color: "var(--color-ink-soft)" }}>
          {t("invalidBody")}
        </p>
      </main>
    );
  }

  const summary = bundle.medicalSummary;
  const hasFlags =
    !!summary &&
    (summary.bloodGroup || summary.allergies.length > 0 || summary.chronicConditions.length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("heading")}</h1>
      <p className="mt-1 text-lg font-semibold">{bundle.subjectFullName}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {bundle.expiresAt
          ? t("expiresLabel", {
              date: `${formatClinicDate(bundle.expiresAt, locale)} ${formatClinicTime(bundle.expiresAt, locale)}`,
            })
          : t("neverExpiresLabel")}
      </p>

      <div className="chart mt-6">
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
      </div>

      {bundle.scope.includeClinicalHistory && (
        <div className="mt-8">
          <h2 className="lbl" style={{ color: "var(--color-ink-soft)" }}>
            {t("visitHistoryHeading")}
          </h2>
          {bundle.clinicalHistory.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {t("noVisitHistory")}
            </p>
          ) : (
            <div className="tl mt-3">
              {bundle.clinicalHistory.map((entry) => (
                <div key={entry.appointmentId} className="tli">
                  <span className="td">{formatClinicDate(entry.scheduledStart, locale)}</span>
                  <div>
                    <b className="disp font-semibold">
                      {entry.practitionerFullName}
                      {entry.diagnosis ? ` — ${entry.diagnosis}` : ""}
                    </b>
                    <small>{entry.clinicName}</small>
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
                              {[item.dosage, item.frequency, item.duration]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(bundle.scope.includeLabReports || bundle.scope.includeOtherRecords) && (
        <div className="mt-8">
          <h2 className="lbl" style={{ color: "var(--color-ink-soft)" }}>
            {t("recordsHeading")}
          </h2>
          {bundle.records.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {t("noRecords")}
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {bundle.records.map((record) => (
                <li key={record.id} className="vslip flex items-center justify-between">
                  <div>
                    <b className="disp font-semibold">{record.fileName}</b>
                    <small className="mono">
                      {tVault(`types.${record.recordType}` as "types.prescription_photo")}
                    </small>
                  </div>
                  {record.url && (
                    <a
                      href={record.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn gh sm tap-target"
                    >
                      {t("view")}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-8 text-xs" style={{ color: "var(--color-ink-soft)" }}>
        {t("footerNote")}
      </p>
    </main>
  );
}
