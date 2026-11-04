import { intlLocale } from "@/i18n/routing";

/**
 * v1 is Pakistan-only (see apps/api's availability.ts CLINIC_UTC_OFFSET and
 * notification-listener.service.ts's formatWhen) — every displayed
 * date/time must be pinned to the clinic's own timezone, not the viewer's.
 * A bare toLocaleString()/toLocaleTimeString() uses the browser/OS's local
 * timezone instead, which silently drifts from the real appointment time
 * whenever the viewer isn't physically in Pakistan or their device clock
 * isn't set to it — confirmed as a real bug: a 16:40 UTC (9:40 PM PKT) slot
 * displayed as "4:40 PM" to a browser set to UTC, and the patient booked it
 * believing it was hours earlier than it actually was.
 */
const CLINIC_TIME_ZONE = "Asia/Karachi";

export function formatClinicDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(intlLocale(locale), {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatClinicTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale(locale), {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClinicDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), { timeZone: CLINIC_TIME_ZONE });
}

/** Today's date (YYYY-MM-DD) in the clinic's own timezone, not the server's. */
export function clinicTodayIso(): string {
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  return new Date(Date.now() + pktOffsetMs).toISOString().slice(0, 10);
}
