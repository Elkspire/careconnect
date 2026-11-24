import { computeAvailableSlots, type WeeklyTimings } from './availability';

// 2030-01-07 is a Monday. Clinic time is Asia/Karachi (UTC+5), so 09:00 there
// is 04:00 UTC.
const MON = '2030-01-07';
const TUE = '2030-01-08';
const BEFORE_ALL = new Date('2029-12-31T00:00:00Z');

const at = (date: string, hhmm: string) =>
  new Date(`${date}T${hhmm}:00+05:00`).toISOString();

function slots(
  overrides: Partial<Parameters<typeof computeAvailableSlots>[0]> = {},
) {
  return computeAvailableSlots({
    timings: { mon: [{ start: '09:00', end: '10:00' }] },
    slotLengthMinutes: 20,
    dailyPatientCap: null,
    fromDate: MON,
    toDate: MON,
    busyRanges: [],
    leaveRanges: [],
    now: BEFORE_ALL,
    ...overrides,
  });
}

const starts = (days: ReturnType<typeof slots>) =>
  days.flatMap((d) => d.slots.map((s) => s.start));

describe('computeAvailableSlots', () => {
  it('splits a working range into slots of the configured length', () => {
    expect(slots()).toEqual([
      {
        date: MON,
        slots: [
          { start: at(MON, '09:00'), end: at(MON, '09:20') },
          { start: at(MON, '09:20'), end: at(MON, '09:40') },
          { start: at(MON, '09:40'), end: at(MON, '10:00') },
        ],
      },
    ]);
  });

  it('interprets timings in Pakistan time (UTC+5)', () => {
    expect(starts(slots())[0]).toBe('2030-01-07T04:00:00.000Z');
  });

  it('drops a trailing slot that would run past the end of the range', () => {
    const result = slots({
      timings: { mon: [{ start: '09:00', end: '09:50' }] },
    });
    expect(starts(result)).toEqual([at(MON, '09:00'), at(MON, '09:20')]);
  });

  it('supports several ranges in one day', () => {
    const timings: WeeklyTimings = {
      mon: [
        { start: '09:00', end: '09:20' },
        { start: '17:00', end: '17:20' },
      ],
    };
    expect(starts(slots({ timings }))).toEqual([
      at(MON, '09:00'),
      at(MON, '17:00'),
    ]);
  });

  it('returns an empty day when there are no timings for that weekday', () => {
    expect(slots({ fromDate: TUE, toDate: TUE })).toEqual([
      { date: TUE, slots: [] },
    ]);
  });

  it('returns one entry per day across the range, inclusive', () => {
    const result = slots({
      timings: {
        mon: [{ start: '09:00', end: '09:20' }],
        tue: [{ start: '09:00', end: '09:20' }],
      },
      toDate: TUE,
    });
    expect(result.map((d) => d.date)).toEqual([MON, TUE]);
    expect(starts(result)).toEqual([at(MON, '09:00'), at(TUE, '09:00')]);
  });

  it('rolls over month and year boundaries', () => {
    const result = slots({ fromDate: '2030-12-30', toDate: '2031-01-02' });
    expect(result.map((d) => d.date)).toEqual([
      '2030-12-30',
      '2030-12-31',
      '2031-01-01',
      '2031-01-02',
    ]);
  });

  it('hides slots that have already started', () => {
    const result = slots({ now: new Date(at(MON, '09:20')) });
    expect(starts(result)).toEqual([at(MON, '09:40')]);
  });

  it('hides a slot that overlaps a booking', () => {
    const result = slots({
      busyRanges: [
        { start: new Date(at(MON, '09:20')), end: new Date(at(MON, '09:40')) },
      ],
    });
    expect(starts(result)).toEqual([at(MON, '09:00'), at(MON, '09:40')]);
  });

  it('hides every slot a longer booking overlaps, even partly', () => {
    const result = slots({
      busyRanges: [
        { start: new Date(at(MON, '09:10')), end: new Date(at(MON, '09:30')) },
      ],
    });
    expect(starts(result)).toEqual([at(MON, '09:40')]);
  });

  it('keeps slots that only touch a booking at the edges', () => {
    const result = slots({
      busyRanges: [
        { start: new Date(at(MON, '09:20')), end: new Date(at(MON, '09:40')) },
      ],
    });
    // 09:00-09:20 ends as the booking starts; 09:40-10:00 starts as it ends.
    expect(starts(result)).toEqual([at(MON, '09:00'), at(MON, '09:40')]);
  });

  it('closes the day once the daily patient cap is reached', () => {
    const busy = (hhmm: string) => ({
      start: new Date(at(MON, hhmm)),
      end: new Date(new Date(at(MON, hhmm)).getTime() + 20 * 60_000),
    });
    expect(slots({ dailyPatientCap: 1, busyRanges: [busy('09:00')] })).toEqual([
      { date: MON, slots: [] },
    ]);
    expect(
      starts(slots({ dailyPatientCap: 2, busyRanges: [busy('09:00')] })),
    ).toHaveLength(2);
  });

  it('counts only that day’s bookings towards the cap', () => {
    const result = slots({
      dailyPatientCap: 1,
      toDate: TUE,
      timings: {
        mon: [{ start: '09:00', end: '09:20' }],
        tue: [{ start: '09:00', end: '09:20' }],
      },
      busyRanges: [
        { start: new Date(at(TUE, '09:00')), end: new Date(at(TUE, '09:20')) },
      ],
    });
    expect(result).toEqual([
      {
        date: MON,
        slots: [{ start: at(MON, '09:00'), end: at(MON, '09:20') }],
      },
      { date: TUE, slots: [] },
    ]);
  });

  it('closes days that fall inside a leave range, inclusive at both ends', () => {
    const timings: WeeklyTimings = {
      mon: [{ start: '09:00', end: '09:20' }],
      tue: [{ start: '09:00', end: '09:20' }],
      wed: [{ start: '09:00', end: '09:20' }],
    };
    const result = slots({
      timings,
      toDate: '2030-01-09',
      leaveRanges: [{ startsOn: MON, endsOn: TUE }],
    });
    expect(result.map((d) => d.slots.length)).toEqual([0, 0, 1]);
  });
});
