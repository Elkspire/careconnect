/**
 * v1 is Pakistan-only — mirrors apps/web/lib/format-time.ts exactly (same
 * bug it fixed applies here too: a bare toLocaleString uses the device's
 * local timezone, which silently drifts from the real appointment time
 * whenever the phone isn't set to Pakistan time).
 */
const CLINIC_TIME_ZONE = "Asia/Karachi";

export function formatClinicDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatClinicTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClinicDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: CLINIC_TIME_ZONE });
}

/** Today's date (YYYY-MM-DD) in the clinic's own timezone, not the device's. */
export function clinicTodayIso(): string {
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  return new Date(Date.now() + pktOffsetMs).toISOString().slice(0, 10);
}

/** clinicTodayIso() plus N days, still expressed as a PKT calendar date. */
export function clinicDateIsoPlusDays(days: number): string {
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + pktOffsetMs + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
