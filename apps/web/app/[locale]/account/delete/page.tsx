import { TriangleAlert, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDeletionPreview } from "@/lib/api/account";
import { getMe } from "@/lib/api/me";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteAccountAction } from "../actions";

/**
 * Self-service account deletion, for every kind of account. What actually
 * happens differs a lot by role (see the API's AccountService), so the
 * page spells out the consequences for *this* account before asking for
 * the typed confirmation.
 */
export default async function DeleteAccountPage(props: PageProps<"/[locale]/account/delete">) {
  const sp = await props.searchParams;
  const error = sp.error === "confirm" ? "confirm" : sp.error === "failed" ? "failed" : null;
  const [t, me, preview] = await Promise.all([
    getTranslations("account"),
    getMe(),
    getDeletionPreview(),
  ]);

  const staffRoles = me.clinicStaff.filter((s) => s.status === "active" && s.role !== "owner");
  const consequences: string[] = [];
  if (preview.ownedClinics.length > 0) {
    consequences.push(
      t("ownerClinics", { clinics: preview.ownedClinics.map((c) => c.name).join(", ") }),
    );
    if (preview.upcomingAtOwnedClinics > 0) {
      consequences.push(t("ownerUpcoming", { count: preview.upcomingAtOwnedClinics }));
    }
  }
  if (preview.isPractitioner) {
    consequences.push(t("practitionerProfile"));
  }
  if (staffRoles.length > 0) {
    consequences.push(t("staffAccess"));
  }
  if (preview.isPatient) {
    consequences.push(t("patientData"));
    if (preview.upcomingAsPatient > 0) {
      consequences.push(t("patientUpcoming", { count: preview.upcomingAsPatient }));
    }
    consequences.push(t("patientRecordsKept"));
  }
  consequences.push(t("login"));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <PageHeader icon={UserX} kicker="CareConnect" title={t("heading")} />

      <Card padding="lg">
        <Alert tone="danger" title={t("permanentTitle")} description={t("permanentBody")} />

        <h2 className="mt-6 text-sm font-semibold text-text">{t("whatHappens")}</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {consequences.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm text-text-muted">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-fg" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="my-6 border-t border-border" />

        {error && (
          <div className="mb-4">
            <Alert
              tone="danger"
              title={error === "confirm" ? t("confirmMismatch") : t("deleteFailed")}
            />
          </div>
        )}

        <form action={deleteAccountAction} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">
              {t.rich("confirmLabel", {
                word: (chunks) => (
                  <code className="rounded bg-danger-bg px-1.5 py-0.5 font-mono text-danger-fg">
                    {chunks}
                  </code>
                ),
              })}
            </span>
            <input
              type="text"
              name="confirm"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              placeholder="DELETE"
              className="tap-target w-full rounded-md border border-border-strong px-3 py-2 font-mono text-sm text-text focus:border-danger-fg focus:outline-2 focus:outline-offset-1 focus:outline-danger-fg"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="tap-target rounded-md bg-danger-fg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              {t("deleteButton")}
            </SubmitButton>
            <Link
              href="/post-login"
              className="tap-target flex items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-muted hover:text-text"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
