import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { availabilityQuerySchema } from '@careconnect/validation';
import { getTableColumns, type Table } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pg-proxy';
import type { Database } from '../../common/database/database.module';
import { appointments, practitionerClinic } from '../../common/database/schema';
import type { PatientsService } from '../patients/patients.service';
import { BookingService } from './booking.service';

const PATIENT = 'patient-1';
const STAFF = 'staff-1';
const IDS = { practitionerId: 'doctor-1', clinicId: 'clinic-1' };

// Monday 2030-01-07, 08:00 in Pakistan. Clinic hours are 09:00-10:00.
const NOW = new Date('2030-01-07T08:00:00+05:00');
const at = (hhmm: string, date = '2030-01-07') =>
  new Date(`${date}T${hhmm}:00+05:00`).toISOString();

interface World {
  busy?: string[]; // start times of other 20-minute appointments
  cap?: number | null;
  onLeave?: boolean;
  practises?: boolean;
  windowHours?: number;
  status?: string;
  scheduledStart?: string;
  staff?: { role: string; revoked?: string[] };
  /** The guarded UPDATE matches nothing: someone changed the row first. */
  lostRace?: boolean;
}

const rowOf = (table: Table, values: Record<string, unknown>) =>
  Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);

const twentyMinutesAfter = (iso: string) =>
  new Date(new Date(iso).getTime() + 20 * 60_000).toISOString();

/**
 * Drizzle builds the service's real SQL; only the round trip is scripted.
 * What the database itself enforces (the lock, the WHERE clauses) is covered
 * by test/booking.e2e-spec.ts.
 */
function setup(world: World = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const events: string[] = [];

  const appointment = (over: Record<string, unknown> = {}) =>
    rowOf(appointments, {
      id: 'appointment-1',
      patientId: PATIENT,
      subjectType: 'self',
      ...IDS,
      scheduledStart: world.scheduledStart ?? at('09:00'),
      scheduledEnd: twentyMinutesAfter(world.scheduledStart ?? at('09:00')),
      status: world.status ?? 'booked',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      ...over,
    });

  const answer = (sql: string): unknown[][] => {
    if (sql.startsWith('insert into "appointments"')) return [appointment()];
    if (sql.startsWith('update "appointments"')) {
      return world.lostRace ? [] : [appointment()];
    }
    if (sql.includes('from "clinic_staff"')) {
      return world.staff
        ? [[world.staff.role, `{${(world.staff.revoked ?? []).join(',')}}`]]
        : [];
    }
    if (sql.includes('from "practitioner_clinic"')) {
      if (!sql.includes('"timings"')) return [[world.windowHours ?? 1]];
      return world.practises === false
        ? []
        : [
            rowOf(practitionerClinic, {
              id: 'pc-1',
              ...IDS,
              slotLengthMinutes: 20,
              dailyPatientCap: world.cap ?? null,
              timings: { mon: [{ start: '09:00', end: '10:00' }] },
              isActive: true,
            }),
          ];
    }
    if (sql.includes('from "practitioner_leave"')) {
      return world.onLeave ? [['2030-01-07', '2030-01-07']] : [];
    }
    if (sql.includes('from "appointments"')) {
      return sql.includes('"patient_id"')
        ? [appointment()]
        : (world.busy ?? []).map((s) => [s, twentyMinutesAfter(s)]);
    }
    return [];
  };

  const db = drizzle((sql, params) => {
    queries.push({ sql, params });
    return Promise.resolve({ rows: answer(sql) });
  });
  // The proxy driver has no transactions; mark where one starts and ends.
  Object.assign(db, {
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      queries.push({ sql: 'BEGIN', params: [] });
      const result = await run(db);
      queries.push({ sql: 'COMMIT', params: [] });
      return result;
    },
  });

  const service = new BookingService(
    db as unknown as Database,
    {} as PatientsService,
    {
      emit: (name: string) => events.push(name),
    } as unknown as EventEmitter2,
  );
  const wrote = () =>
    queries.some((q) => /^(insert into|update) "appointments"/.test(q.sql));

  return {
    queries,
    events,
    wrote,
    book: (scheduledStart: string) =>
      service.createAppointment(PATIENT, {
        subjectType: 'self',
        ...IDS,
        scheduledStart,
      }),
    reschedule: (caller: string, scheduledStart: string) =>
      service.rescheduleAppointment(caller, {
        appointmentId: 'appointment-1',
        scheduledStart,
      }),
    cancel: (caller: string) =>
      service.cancelAppointment(caller, { appointmentId: 'appointment-1' }),
  };
}

describe('BookingService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
  });
  afterEach(() => jest.useRealTimers());

  describe('booking a slot', () => {
    it('accepts an open one', async () => {
      const t = setup();
      await t.book(at('09:20'));
      expect(t.wrote()).toBe(true);
      expect(t.events).toEqual(['appointment.booked']);
    });

    it('accepts the slots either side of a booked one', async () => {
      for (const slot of ['09:00', '09:40']) {
        const t = setup({ busy: [at('09:20')] });
        await t.book(at(slot));
        expect(t.wrote()).toBe(true);
      }
    });

    const refusals: Array<[string, string, World]> = [
      ['a time in the past', at('09:00', '2029-12-31'), {}],
      ['a time before opening', at('08:40'), {}],
      ['a slot that would run past closing', at('10:00'), {}],
      ['a time off the slot grid', at('09:07'), {}],
      ['a day with no hours', at('09:00', '2030-01-08'), {}],
      ['a taken slot', at('09:20'), { busy: [at('09:20')] }],
      ['a slot overlapping a booking', at('09:20'), { busy: [at('09:10')] }],
      ['a day on leave', at('09:20'), { onLeave: true }],
      ['a day at its cap', at('09:40'), { cap: 1, busy: [at('09:00')] }],
    ];
    it.each(refusals)('refuses %s', async (_what, slot, world) => {
      const t = setup(world);
      await expect(t.book(slot)).rejects.toBeInstanceOf(ConflictException);
      expect(t.wrote()).toBe(false);
      expect(t.events).toEqual([]);
    });

    it('404s where the practitioner does not practise', async () => {
      const t = setup({ practises: false });
      await expect(t.book(at('09:20'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(t.wrote()).toBe(false);
    });

    it('locks before it looks, and writes in the same transaction', async () => {
      const t = setup();
      await t.book(at('09:20'));
      const position = (match: string) =>
        t.queries.findIndex((q) => q.sql.includes(match));
      const steps = [
        'BEGIN',
        'pg_advisory_xact_lock',
        'from "appointments"',
        'insert into "appointments"',
        'COMMIT',
      ].map(position);
      expect(steps).not.toContain(-1);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      expect(t.queries[steps[1]!]!.params).toEqual(['doctor-1:clinic-1']);
    });
  });

  describe('rescheduling', () => {
    it('moves to an open slot', async () => {
      const t = setup();
      await t.reschedule(PATIENT, at('09:40'));
      expect(t.events).toEqual(['appointment.rescheduled']);
    });

    it('does not count the appointment being moved against itself', async () => {
      const t = setup();
      await t.reschedule(PATIENT, at('09:20'));
      const busy = t.queries.find(
        (q) =>
          q.sql.includes('from "appointments"') &&
          !q.sql.includes('"patient_id"'),
      )!;
      expect(busy.sql).toContain('"appointments"."id" <> ');
      expect(busy.params).toContain('appointment-1');
    });

    it('refuses a time availability would not offer', async () => {
      const t = setup();
      await expect(t.reschedule(PATIENT, at('12:00'))).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(t.wrote()).toBe(false);
    });

    it.each(['checked_in', 'completed', 'cancelled', 'no_show'])(
      'refuses a %s appointment',
      async (status) => {
        const t = setup({ status });
        await expect(t.reschedule(PATIENT, at('09:40'))).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(t.wrote()).toBe(false);
      },
    );

    it('holds patients, but not staff, to the cancellation window', async () => {
      const world: World = { windowHours: 2, staff: { role: 'receptionist' } };
      const asPatient = setup(world);
      await expect(
        asPatient.reschedule(PATIENT, at('09:40')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(asPatient.wrote()).toBe(false);

      const asStaff = setup(world);
      await asStaff.reschedule(STAFF, at('09:40'));
      expect(asStaff.wrote()).toBe(true);
    });

    it('fails if the appointment changed in the meantime', async () => {
      const t = setup({ lostRace: true });
      await expect(t.reschedule(PATIENT, at('09:40'))).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(t.events).toEqual([]);
    });
  });

  describe('cancelling', () => {
    it.each(['booked', 'checked_in'])('allows a %s one', async (status) => {
      const t = setup({ status });
      await t.cancel(PATIENT);
      expect(t.events).toEqual(['appointment.cancelled']);
    });

    it.each(['completed', 'cancelled', 'no_show'])(
      'refuses a %s one, even for staff',
      async (status) => {
        const t = setup({ status, staff: { role: 'owner' } });
        await expect(t.cancel(STAFF)).rejects.toBeInstanceOf(ConflictException);
        expect(t.wrote()).toBe(false);
      },
    );

    it('holds patients to the cancellation window', async () => {
      const t = setup({ windowHours: 2 });
      await expect(t.cancel(PATIENT)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(t.wrote()).toBe(false);
    });

    it('fails if the appointment changed in the meantime', async () => {
      const t = setup({ lostRace: true });
      await expect(t.cancel(PATIENT)).rejects.toBeInstanceOf(ConflictException);
      expect(t.events).toEqual([]);
    });
  });

  describe('which staff may change an appointment', () => {
    const changes = ['cancel', 'reschedule'] as const;
    const act = (t: ReturnType<typeof setup>, change: string) =>
      change === 'cancel' ? t.cancel(STAFF) : t.reschedule(STAFF, at('09:40'));

    it.each(changes)('owner and receptionist can %s', async (change) => {
      for (const role of ['owner', 'receptionist']) {
        const t = setup({ staff: { role } });
        await act(t, change);
        expect(t.wrote()).toBe(true);
      }
    });

    it.each(changes)(
      'a receptionist without check-in permission cannot %s',
      async (change) => {
        const t = setup({
          staff: { role: 'receptionist', revoked: ['checkInPatients'] },
        });
        await expect(act(t, change)).rejects.toBeInstanceOf(ForbiddenException);
        expect(t.wrote()).toBe(false);
      },
    );

    it.each(changes)('nobody else can %s', async (change) => {
      const t = setup();
      await expect(act(t, change)).rejects.toBeInstanceOf(ForbiddenException);
      expect(t.wrote()).toBe(false);
      const lookup = t.queries.find((q) =>
        q.sql.includes('from "clinic_staff"'),
      )!;
      expect(lookup.params.slice(0, 5)).toEqual([
        'clinic-1',
        STAFF,
        'active',
        'owner',
        'receptionist',
      ]);
    });
  });
});

describe('availabilityQuerySchema', () => {
  const ok = (fromDate: string, toDate: string) =>
    availabilityQuerySchema.safeParse({
      practitionerId: '11111111-1111-1111-1111-111111111111',
      clinicId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      fromDate,
      toDate,
    }).success;

  it('allows up to 31 days', () => {
    expect(ok('2030-01-01', '2030-01-01')).toBe(true);
    expect(ok('2030-01-01', '2030-01-31')).toBe(true);
    expect(ok('2030-01-01', '2030-02-01')).toBe(false);
    expect(ok('2030-01-01', '9999-12-31')).toBe(false);
  });

  it('refuses a backwards range', () => {
    expect(ok('2030-01-02', '2030-01-01')).toBe(false);
  });
});
