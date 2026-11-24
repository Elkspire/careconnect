/**
 * Pure availability computation: practitioner_clinic.timings minus existing
 * appointments minus practitioner_leave, computed at query time (no
 * persisted slots table — see the Phase 1 plan's booking schema notes).
 *
 * v1 assumes Asia/Karachi (UTC+5, no DST) since the product targets
 * Pakistan only (product doc: single-city v1). Revisit with a real
 * timezone library if the product ever expands beyond Pakistan.
 */

const CLINIC_UTC_OFFSET = '+05:00';
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = (typeof DAY_KEYS)[number];

export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export type WeeklyTimings = Partial<Record<DayKey, TimeRange[]>>;

export interface LeaveRange {
  startsOn: string; // "YYYY-MM-DD"
  endsOn: string; // "YYYY-MM-DD"
}

export interface BusyRange {
  start: Date;
  end: Date;
}

export interface DayAvailability {
  date: string;
  slots: Array<{ start: string; end: string }>;
}

/** dateStr is always a validated "YYYY-MM-DD" string (see availabilityQuerySchema). */
function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = dateStr.split('-', 3);
  return { year: Number(y), month: Number(m), day: Number(d) };
}

function dateStringToUtcDayIndex(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function combineDateAndTime(dateStr: string, hhmm: string): Date {
  return new Date(`${dateStr}T${hhmm}:00${CLINIC_UTC_OFFSET}`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Whole days from one date to another; negative when `to` is earlier. */
function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / DAY_MS;
}

/** The "YYYY-MM-DD" an instant falls on in clinic-local time. */
export function toClinicDateString(date: Date): string {
  return new Date(date.getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function isOnLeave(dateStr: string, leaveRanges: LeaveRange[]): boolean {
  return leaveRanges.some(
    (leave) => dateStr >= leave.startsOn && dateStr <= leave.endsOn,
  );
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeAvailableSlots(params: {
  timings: WeeklyTimings;
  slotLengthMinutes: number;
  dailyPatientCap: number | null;
  fromDate: string;
  toDate: string;
  busyRanges: BusyRange[];
  leaveRanges: LeaveRange[];
  now?: Date;
}): DayAvailability[] {
  const {
    timings,
    slotLengthMinutes,
    dailyPatientCap,
    fromDate,
    toDate,
    busyRanges,
    leaveRanges,
  } = params;
  const now = params.now ?? new Date();
  const days: DayAvailability[] = [];

  // Counted rather than compared as strings: the day after 9999-12-31 is
  // "+010000-01-01", which sorts before it.
  const dayCount = daysBetween(fromDate, toDate) + 1;
  for (let i = 0; i < dayCount; i++) {
    const dateStr = addDays(fromDate, i);
    if (isOnLeave(dateStr, leaveRanges)) {
      days.push({ date: dateStr, slots: [] });
      continue;
    }

    const dayKey = DAY_KEYS[dateStringToUtcDayIndex(dateStr)] as DayKey;
    const ranges = timings[dayKey] ?? [];

    const dayStart = combineDateAndTime(dateStr, '00:00');
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const dayBusy = busyRanges.filter(
      (b) => b.start >= dayStart && b.start < dayEnd,
    );

    if (dailyPatientCap !== null && dayBusy.length >= dailyPatientCap) {
      days.push({ date: dateStr, slots: [] });
      continue;
    }

    const slots: Array<{ start: string; end: string }> = [];
    for (const range of ranges) {
      let cursor = combineDateAndTime(dateStr, range.start);
      const rangeEnd = combineDateAndTime(dateStr, range.end);

      while (
        cursor.getTime() + slotLengthMinutes * 60_000 <=
        rangeEnd.getTime()
      ) {
        const slotEnd = new Date(cursor.getTime() + slotLengthMinutes * 60_000);

        const isPast = cursor <= now;
        const isBusy = dayBusy.some((b) =>
          overlaps(cursor, slotEnd, b.start, b.end),
        );

        if (!isPast && !isBusy) {
          slots.push({
            start: cursor.toISOString(),
            end: slotEnd.toISOString(),
          });
        }

        cursor = slotEnd;
      }
    }

    days.push({ date: dateStr, slots });
  }

  return days;
}
