import { EventEmitter2 } from '@nestjs/event-emitter';
import { drizzle } from 'drizzle-orm/pg-proxy';
import type { Database } from '../../common/database/database.module';
import { NoShowService } from '../booking/no-show.service';
import {
  EVENT_APPOINTMENT_NO_SHOW,
  EVENT_APPOINTMENT_REMINDER,
} from '../notifications/events';
import { ReminderService } from '../notifications/reminder.service';

const NOW = new Date('2026-11-25T10:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

/** Drizzle builds the service's real SQL; only the round trip is scripted. */
function setup(rowsPerQuery: unknown[][][]) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db = drizzle((sql, params) => {
    queries.push({ sql, params });
    return Promise.resolve({ rows: rowsPerQuery[queries.length - 1] ?? [] });
  });
  const events = new EventEmitter2();
  return {
    queries,
    events,
    noShows: new NoShowService(db as unknown as Database, events),
    reminders: new ReminderService(db as unknown as Database, events),
  };
}

/** A listener that takes a while, like a real SMS does. */
function slowListener(events: EventEmitter2, name: string) {
  const finished: string[] = [];
  let running = 0;
  let mostAtOnce = 0;
  const listener = async (e: { appointment: { appointmentId: string } }) => {
    mostAtOnce = Math.max(mostAtOnce, ++running);
    await new Promise((resolve) => setImmediate(resolve));
    running--;
    finished.push(e.appointment.appointmentId);
  };
  // emitAsync awaits what a listener returns; the type just says void.
  events.on(name, listener as (...args: unknown[]) => void);
  return { finished, mostAtOnce: () => mostAtOnce };
}

const visit = (id: string, ...times: Date[]) => [
  id,
  'patient-1',
  'doctor-1',
  'clinic-1',
  ...times.map((t) => t.toISOString()),
];

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick'] });
});
afterEach(() => jest.useRealTimers());

describe('NoShowService', () => {
  it('closes only booked visits whose slot has ended', async () => {
    const { noShows, queries } = setup([[]]);
    await expect(noShows.markNoShows()).resolves.toBe(0);
    expect(queries).toHaveLength(1);
    expect(queries[0]!.sql).toMatch(
      /^update "appointments" set "status" = \$1.* where \("appointments"\."status" = \$\d and "appointments"\."scheduled_end" < \$\d\)/,
    );
    expect(queries[0]!.params).toEqual(
      expect.arrayContaining(['no_show', 'booked', NOW.toISOString()]),
    );
  });

  it('waits for every notification before finishing', async () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      visit(`v${i}`, at(-HOUR), at(-HOUR / 2)),
    );
    const { noShows, events } = setup([rows]);
    const listener = slowListener(events, EVENT_APPOINTMENT_NO_SHOW);
    await expect(noShows.markNoShows()).resolves.toBe(25);
    expect(listener.finished).toEqual(rows.map((r) => r[0]));
    expect(listener.mostAtOnce()).toBe(10);
  });

  it('closes an old visit without messaging the patient', async () => {
    const { noShows, events } = setup([
      [
        visit('last run', at(-26 * HOUR), at(-25 * HOUR)),
        visit('old', at(-27 * HOUR), at(-26 * HOUR)),
      ],
    ]);
    const { finished } = slowListener(events, EVENT_APPOINTMENT_NO_SHOW);
    await expect(noShows.markNoShows()).resolves.toBe(2);
    expect(finished).toEqual(['last run']);
  });
});

describe('ReminderService', () => {
  // The clinic day starts at 19:00 UTC, so the last two are already the 26th
  // in Pakistan.
  it.each([
    ['at the start of the cron hour', '2026-11-25T13:00:00Z', 25],
    ['at the end of the cron hour', '2026-11-25T13:59:59Z', 25],
    ['just before midnight in Pakistan', '2026-11-25T18:59:59Z', 25],
    ['at midnight in Pakistan', '2026-11-25T19:00:00Z', 26],
    ['after midnight in Pakistan', '2026-11-25T23:30:00Z', 26],
  ])(
    'covers all of tomorrow in Pakistan when run %s',
    async (_name, now, start) => {
      jest.setSystemTime(new Date(now));
      const { reminders, queries } = setup([[]]);
      await expect(reminders.sendReminders()).resolves.toBe(0);
      expect(queries).toHaveLength(1);
      expect(queries[0]!.sql).toContain('not exists (select');
      expect(queries[0]!.params).toEqual([
        'booked',
        `2026-11-${start}T19:00:00.000Z`,
        `2026-11-${start + 1}T19:00:00.000Z`,
        `${EVENT_APPOINTMENT_REMINDER}.24h`,
      ]);
    },
  );

  it('waits for every reminder before finishing', async () => {
    const { reminders, events } = setup([
      [visit('morning', at(24 * HOUR)), visit('evening', at(30 * HOUR))],
    ]);
    const { finished } = slowListener(events, EVENT_APPOINTMENT_REMINDER);
    await expect(reminders.sendReminders()).resolves.toBe(2);
    expect(finished).toEqual(['morning', 'evening']);
  });
});
