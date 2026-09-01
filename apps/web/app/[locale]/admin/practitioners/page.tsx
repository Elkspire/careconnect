import { getTranslations } from "next-intl/server";
import { listPendingPractitioners } from "@/lib/api/admin";
import { formatClinicDate } from "@/lib/format-time";
import { rejectPractitionerAction, verifyPractitionerAction } from "../actions";

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
        <div className="locked">
          <div className="lockmsg">
            <span className="mono">{t("accessDenied")}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("heading")}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {t("scopeNote")}
      </p>

      {practitioners.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {practitioners.map((p) => (
            <li key={p.id} className="chart">
              <div className="cn">
                <b>{p.fullName}</b>
                <small>
                  {p.practitionerType} · {t("joinedLabel")} {formatClinicDate(p.createdAt, locale)}
                </small>
              </div>
              <div className="pgrid">
                <div className="prow">
                  <span>{t("registrationNoLabel")}</span>
                  <em>{p.councilRegistrationNo}</em>
                </div>
                <div className="prow">
                  <span>{t("phoneLabel")}</span>
                  <em>{p.phone ?? "—"}</em>
                </div>
                <div className="prow">
                  <span>{t("statusLabel")}</span>
                  <em>{p.verificationStatus}</em>
                </div>
              </div>
              {p.verificationNote && (
                <p className="mt-2 text-sm" style={{ color: "var(--color-seal)" }}>
                  {t("lastNoteLabel")}: {p.verificationNote}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <form action={verify}>
                  <input type="hidden" name="practitionerId" value={p.id} />
                  <button type="submit" className="btn sm tap-target">
                    {t("verify")}
                  </button>
                </form>
                <details>
                  <summary
                    className="mono text-xs tap-target"
                    style={{ color: "var(--color-seal)" }}
                  >
                    {t("reject")}
                  </summary>
                  <form action={reject} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="practitionerId" value={p.id} />
                    <label>
                      <span className="lbl">{t("rejectReasonLabel")}</span>
                      <input type="text" name="reason" required className="field tap-target" />
                    </label>
                    <button type="submit" className="btn gh sm tap-target">
                      {t("confirmReject")}
                    </button>
                  </form>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
