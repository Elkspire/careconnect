import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listMyNotifications } from "@/lib/api/notifications";
import { formatClinicTime } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PatientNotificationsPage(
  props: PageProps<"/[locale]/patient/notifications">,
) {
  const { locale } = await props.params;
  const [t, notifications] = await Promise.all([
    getTranslations("notifications"),
    listMyNotifications(),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader icon={Bell} kicker="CareConnect" title={t("heading")} />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title={t("empty")} />
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-border">
            {notifications.map((n) => (
              <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <b className="font-semibold capitalize text-text">
                    {n.eventType.replaceAll("_", " ")}
                  </b>
                  <span className="text-xs text-text-muted">
                    {formatClinicTime(n.createdAt, locale)}
                  </span>
                </div>
                {n.message && <p className="mt-1 text-sm text-text-muted">{n.message}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
