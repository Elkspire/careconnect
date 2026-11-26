import { getTranslations } from "next-intl/server";
import type { AuditNoticeKind } from "@/lib/api/audit";
import { Alert } from "@/components/ui/alert";

/** Why medical data isn't shown, or that a change is saved and must not be repeated. */
export async function AuditNotice({ kind }: { kind: AuditNoticeKind }) {
  const t = await getTranslations("audit");
  return (
    <div role="alert" className="mb-5">
      <Alert
        tone={kind === "refused" ? "danger" : "warning"}
        title={t(`${kind}.title`)}
        description={t(`${kind}.body`)}
      />
    </div>
  );
}
