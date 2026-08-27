import { getTranslations } from "next-intl/server";
import { listMyNotifications } from "@/lib/api/notifications";
import { formatClinicTime } from "@/lib/format-time";

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
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("heading")}</h1>
      {notifications.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {notifications.map((n) => (
            <li key={n.id} className="notif">
              <b>
                {n.eventType.replaceAll("_", " ")}
                <em>{formatClinicTime(n.createdAt, locale)}</em>
              </b>
              {n.message && <p>{n.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
