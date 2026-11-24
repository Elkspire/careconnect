import { eq, inArray } from 'drizzle-orm';
import {
  appointments,
  practitionerClinic,
  practitionerLeave,
  waitlistEntries,
} from '../src/common/database/schema';
import {
  bookFirstSlot,
  createPatient,
  createTestApp,
  daysAhead,
  openSlots,
  releaseAppointments,
  SEED,
  type TestApp,
  type TestUser,
  tokens,
} from './support/app';

const DATE = daysAhead(7);

describe('Booking (e2e)', () => {
  let t: TestApp;
  let patient: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    t = await createTestApp();
    patient = await createPatient(t);
    other = await createPatient(t);
  });
  // Hand the slots back so tests don't affect each other and the suite can
  // be re-run without a database reset.
  afterEach(async () => {
    const ids = [patient.id, other.id];
    await t.db
      .delete(waitlistEntries)
      .where(inArray(waitlistEntries.patientId, ids));
    await releaseAppointments(t, ids);
  });
  afterAll(() => t.close());

  const post = (path: string, token: string, body: object) =>
    t
      .http()
      .post(`/booking/${path}`)
      .auth(token, { type: 'bearer' })
      .send(body);
  const book = (token: string, scheduledStart: string, extra: object = {}) =>
    post('appointments', token, {
      subjectType: 'self',
      practitionerId: SEED.doctorId,
      clinicId: SEED.clinicId,
      scheduledStart,
      ...extra,
    });

  describe('availability', () => {
    it('is public', async () => {
      expect((await openSlots(t, DATE)).length).toBeGreaterThan(0);
    });

    it('offers 20-minute slots inside the clinic hours (08:00-22:00 PKT)', async () => {
      const slots = await openSlots(t, DATE);
      expect(slots[0]).toBe(new Date(`${DATE}T08:00:00+05:00`).toISOString());
      expect(slots.at(-1)).toBe(
        new Date(`${DATE}T21:40:00+05:00`).toISOString(),
      );
      expect(slots).toHaveLength(42);
    });

    it('404s for a practitioner who does not practise at the clinic', () =>
      t
        .http()
        .get('/booking/availability')
        .query({
          practitionerId: SEED.patientId,
          clinicId: SEED.clinicId,
          fromDate: DATE,
          toDate: DATE,
        })
        .expect(404));

    it('rejects malformed dates', () =>
      t
        .http()
        .get('/booking/availability')
        .query({
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          fromDate: 'tomorrow',
          toDate: DATE,
        })
        .expect(400));

    it.each([
      ['longer than 31 days', '2030-01-01', '2030-02-01'],
      ['absurdly long', '2030-01-01', '9999-12-31'],
      ['backwards', '2030-01-02', '2030-01-01'],
    ])('rejects a range that is %s', (_why, fromDate, toDate) =>
      t
        .http()
        .get('/booking/availability')
        .query({
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          fromDate,
          toDate,
        })
        .expect(400),
    );

    it('closes days the practitioner is on leave', async () => {
      const [leave] = await t.db
        .insert(practitionerLeave)
        .values({
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          startsOn: DATE,
          endsOn: DATE,
        })
        .returning();
      try {
        expect(await openSlots(t, DATE)).toEqual([]);
        expect((await openSlots(t, daysAhead(8))).length).toBeGreaterThan(0);
      } finally {
        await t.db
          .delete(practitionerLeave)
          .where(eq(practitionerLeave.id, leave!.id));
      }
    });

    it('closes the day once the daily cap is reached', async () => {
      const where = eq(practitionerClinic.clinicId, SEED.clinicId);
      const [config] = await t.db
        .select({ cap: practitionerClinic.dailyPatientCap })
        .from(practitionerClinic)
        .where(where);
      await t.db
        .update(practitionerClinic)
        .set({ dailyPatientCap: 1 })
        .where(where);
      try {
        await bookFirstSlot(t, patient, DATE);
        expect(await openSlots(t, DATE)).toEqual([]);
      } finally {
        await t.db
          .update(practitionerClinic)
          .set({ dailyPatientCap: config!.cap })
          .where(where);
      }
    });
  });

  describe('booking', () => {
    it('requires sign-in', () =>
      t.http().post('/booking/appointments').send({}).expect(401));

    it('takes the slot out of availability and lists it for the patient', async () => {
      const { appointmentId, slot } = await bookFirstSlot(t, patient, DATE);
      expect(await openSlots(t, DATE)).not.toContain(slot);

      const res = await t
        .http()
        .get('/booking/appointments')
        .auth(patient.token, { type: 'bearer' })
        .expect(200);
      expect(res.body).toContainEqual(
        expect.objectContaining({ id: appointmentId, status: 'booked' }),
      );
    });

    it('refuses a second booking for the same slot', async () => {
      const { slot } = await bookFirstSlot(t, patient, DATE);
      await book(other.token, slot).expect(409);
    });

    it('refuses a booking that overlaps an existing one', async () => {
      const { slot } = await bookFirstSlot(t, patient, DATE);
      const tenMinutesIn = new Date(
        new Date(slot).getTime() + 10 * 60_000,
      ).toISOString();
      await book(other.token, tenMinutesIn).expect(409);
    });

    it('allows booking the slot straight after a booked one', async () => {
      const [first, second] = await openSlots(t, DATE);
      await book(patient.token, first!).expect(201);
      await book(other.token, second!).expect(201);
    });

    // Two app instances, as in production: each has its own connection, so
    // only the database can keep their requests apart.
    it('gives a slot to one of many simultaneous requests', async () => {
      const second = await createTestApp();
      try {
        const slot = (await openSlots(t, DATE))[0]!;
        const attempts = [t, second, t, second, t, second].map((app, n) =>
          app
            .http()
            .post('/booking/appointments')
            .auth(n % 4 < 2 ? patient.token : other.token, { type: 'bearer' })
            .send({
              subjectType: 'self',
              practitionerId: SEED.doctorId,
              clinicId: SEED.clinicId,
              scheduledStart: slot,
            }),
        );
        const statuses = (await Promise.all(attempts)).map((r) => r.status);
        expect(statuses.sort()).toEqual([201, 409, 409, 409, 409, 409]);
      } finally {
        await second.close();
      }
    });

    it('lets a slot be booked again once cancelled', async () => {
      const { appointmentId, slot } = await bookFirstSlot(t, patient, DATE);
      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(201);
      expect(await openSlots(t, DATE)).toContain(slot);
      await book(other.token, slot).expect(201);
    });

    it('404s at a clinic the practitioner does not practise at', async () => {
      const slot = (await openSlots(t, DATE))[0]!;
      await book(patient.token, slot, {
        clinicId: '00000000-0000-0000-0000-000000000000',
      }).expect(404);
    });

    it("won't book for someone else's family member", async () => {
      const res = await t
        .http()
        .post('/patients/me/family-members')
        .auth(other.token, { type: 'bearer' })
        .send({ fullName: 'Other Child', relationship: 'child' })
        .expect(201);
      const slot = (await openSlots(t, DATE))[0]!;
      await book(patient.token, slot, {
        subjectType: 'family_member',
        familyMemberId: (res.body as { id: string }).id,
      }).expect(404);
    });

    it('requires familyMemberId when booking for a family member', async () => {
      const slot = (await openSlots(t, DATE))[0]!;
      await book(patient.token, slot, { subjectType: 'family_member' }).expect(
        400,
      );
    });
  });

  describe('reschedule and cancel', () => {
    it('reschedules, freeing the old slot and taking the new one', async () => {
      const { appointmentId, slot } = await bookFirstSlot(t, patient, DATE);
      const target = (await openSlots(t, DATE)).at(-1)!;
      await post('appointments/reschedule', patient.token, {
        appointmentId,
        scheduledStart: target,
      }).expect(201);

      const open = await openSlots(t, DATE);
      expect(open).toContain(slot);
      expect(open).not.toContain(target);
    });

    it('refuses to reschedule into a taken slot', async () => {
      const { slot: taken } = await bookFirstSlot(t, other, DATE);
      const res = await book(
        patient.token,
        (await openSlots(t, DATE)).at(-1)!,
      ).expect(201);
      const appointmentId = (res.body as { id: string }).id;
      await post('appointments/reschedule', patient.token, {
        appointmentId,
        scheduledStart: taken,
      }).expect(409);
    });

    it("does not let a patient touch someone else's appointment", async () => {
      const { appointmentId, slot } = await bookFirstSlot(t, patient, DATE);
      await post('appointments/cancel', other.token, { appointmentId }).expect(
        403,
      );
      await post('appointments/reschedule', other.token, {
        appointmentId,
        scheduledStart: slot,
      }).expect(403);
    });

    it("enforces the clinic's cancellation window on patients, not staff", async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      // The seeded clinic's window is 1 hour; move the visit 30 minutes out.
      const soon = new Date(Date.now() + 30 * 60_000);
      await t.db
        .update(appointments)
        .set({
          scheduledStart: soon,
          scheduledEnd: new Date(soon.getTime() + 20 * 60_000),
        })
        .where(eq(appointments.id, appointmentId));

      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(403);
      await post('appointments/reschedule', patient.token, {
        appointmentId,
        scheduledStart: (await openSlots(t, DATE)).at(-1)!,
      }).expect(403);
      await post('appointments/cancel', tokens.receptionist(), {
        appointmentId,
      }).expect(201);
    });

    it('offers the freed date to the first patient on the waitlist', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      const joined = await post('waitlist', other.token, {
        subjectType: 'self',
        practitionerId: SEED.doctorId,
        clinicId: SEED.clinicId,
        requestedDate: DATE,
      }).expect(201);

      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(201);

      const [entry] = await t.db
        .select({ status: waitlistEntries.status })
        .from(waitlistEntries)
        .where(eq(waitlistEntries.id, (joined.body as { id: string }).id));
      expect(entry?.status).toBe('offered');
    });

    it('lets clinic staff reschedule for a patient', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      const target = (await openSlots(t, DATE)).at(-1)!;
      await post('appointments/reschedule', tokens.receptionist(), {
        appointmentId,
        scheduledStart: target,
      }).expect(201);
      expect(await openSlots(t, DATE)).not.toContain(target);
    });

    it('404s for an appointment that does not exist', async () => {
      const appointmentId = '00000000-0000-0000-0000-000000000000';
      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(404);
      await post('appointments/reschedule', patient.token, {
        appointmentId,
        scheduledStart: new Date(`${DATE}T09:00:00+05:00`).toISOString(),
      }).expect(404);
    });
  });

  describe('who and where', () => {
    it("never lists another patient's appointments", async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      const res = await t
        .http()
        .get('/booking/appointments')
        .auth(other.token, { type: 'bearer' })
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((a) => a.id);
      expect(ids).not.toContain(appointmentId);
    });

    it('books for a family member of the caller', async () => {
      const member = await t
        .http()
        .post('/patients/me/family-members')
        .auth(patient.token, { type: 'bearer' })
        .send({ fullName: 'Own Child', relationship: 'child' })
        .expect(201);
      const familyMemberId = (member.body as { id: string }).id;
      const res = await book(patient.token, (await openSlots(t, DATE))[0]!, {
        subjectType: 'family_member',
        familyMemberId,
      }).expect(201);
      expect(res.body).toMatchObject({
        patientId: patient.id,
        subjectType: 'family_member',
        familyMemberId,
      });
    });

    it('closes a clinic the practitioner has stopped practising at', async () => {
      const slot = (await openSlots(t, DATE))[0]!;
      const where = eq(practitionerClinic.clinicId, SEED.clinicId);
      await t.db
        .update(practitionerClinic)
        .set({ isActive: false })
        .where(where);
      try {
        await book(patient.token, slot).expect(404);
        await t
          .http()
          .get('/booking/availability')
          .query({
            practitionerId: SEED.doctorId,
            clinicId: SEED.clinicId,
            fromDate: DATE,
            toDate: DATE,
          })
          .expect(404);
      } finally {
        await t.db
          .update(practitionerClinic)
          .set({ isActive: true })
          .where(where);
      }
    });

    it('applies leave with no clinic to every clinic', async () => {
      const [leave] = await t.db
        .insert(practitionerLeave)
        .values({
          practitionerId: SEED.doctorId,
          clinicId: null,
          startsOn: DATE,
          endsOn: DATE,
        })
        .returning();
      try {
        expect(await openSlots(t, DATE)).toEqual([]);
      } finally {
        await t.db
          .delete(practitionerLeave)
          .where(eq(practitionerLeave.id, leave!.id));
      }
    });
  });

  describe('waitlist', () => {
    const join = async (user: TestUser) => {
      const res = await post('waitlist', user.token, {
        subjectType: 'self',
        practitionerId: SEED.doctorId,
        clinicId: SEED.clinicId,
        requestedDate: DATE,
      }).expect(201);
      return (res.body as { id: string }).id;
    };
    const leave = (user: TestUser, id: string) =>
      t
        .http()
        .delete(`/booking/waitlist/${id}`)
        .auth(user.token, { type: 'bearer' });
    const statusOf = async (id: string) => {
      const [entry] = await t.db
        .select({ status: waitlistEntries.status })
        .from(waitlistEntries)
        .where(eq(waitlistEntries.id, id));
      return entry?.status;
    };

    it('offers a freed date only to whoever joined first', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      const first = await join(other);
      const second = await join(patient);
      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(201);
      expect(await statusOf(first)).toBe('offered');
      expect(await statusOf(second)).toBe('waiting');
    });

    it('skips someone who has withdrawn', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      const withdrawn = await join(other);
      const next = await join(patient);
      await leave(other, withdrawn).expect(200);
      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(201);
      expect(await statusOf(withdrawn)).toBe('cancelled');
      expect(await statusOf(next)).toBe('offered');
    });

    it('is offered the old date when a booking moves', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      const waiting = await join(other);
      await post('appointments/reschedule', patient.token, {
        appointmentId,
        scheduledStart: (await openSlots(t, daysAhead(8)))[0]!,
      }).expect(201);
      expect(await statusOf(waiting)).toBe('offered');
    });

    it("does not let a patient see or withdraw someone else's entry", async () => {
      const entry = await join(patient);
      await leave(other, entry).expect(404);
      expect(await statusOf(entry)).toBe('waiting');

      const res = await t
        .http()
        .get('/booking/waitlist')
        .auth(other.token, { type: 'bearer' })
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((e) => e.id);
      expect(ids).not.toContain(entry);
    });

    it('can only be withdrawn from once', async () => {
      const entry = await join(patient);
      await leave(patient, entry).expect(200);
      await leave(patient, entry).expect(404);
    });
  });

  describe('refuses what availability would not offer', () => {
    it('a time in the past', async () => {
      const yesterday = new Date(`${daysAhead(-1)}T09:00:00+05:00`);
      await book(patient.token, yesterday.toISOString()).expect(409);
    });

    it('a time outside working hours', async () => {
      const threeAm = new Date(`${DATE}T03:00:00+05:00`);
      await book(patient.token, threeAm.toISOString()).expect(409);
    });

    it('a time that is not on the slot grid', async () => {
      const offGrid = new Date(`${DATE}T09:07:00+05:00`);
      await book(patient.token, offGrid.toISOString()).expect(409);
    });

    it('a day the practitioner is on leave', async () => {
      const slot = (await openSlots(t, DATE))[0]!;
      const [leave] = await t.db
        .insert(practitionerLeave)
        .values({
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          startsOn: DATE,
          endsOn: DATE,
        })
        .returning();
      try {
        await book(patient.token, slot).expect(409);
      } finally {
        await t.db
          .delete(practitionerLeave)
          .where(eq(practitionerLeave.id, leave!.id));
      }
    });

    it('a booking over the daily cap', async () => {
      const lastSlot = (await openSlots(t, DATE)).at(-1)!;
      const where = eq(practitionerClinic.clinicId, SEED.clinicId);
      const [config] = await t.db
        .select({ cap: practitionerClinic.dailyPatientCap })
        .from(practitionerClinic)
        .where(where);
      await t.db
        .update(practitionerClinic)
        .set({ dailyPatientCap: 1 })
        .where(where);
      try {
        await bookFirstSlot(t, patient, DATE);
        await book(other.token, lastSlot).expect(409);
      } finally {
        await t.db
          .update(practitionerClinic)
          .set({ dailyPatientCap: config!.cap })
          .where(where);
      }
    });
  });

  describe('appointment status', () => {
    it('a cancelled appointment cannot be changed again', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(201);
      await post('appointments/reschedule', patient.token, {
        appointmentId,
        scheduledStart: (await openSlots(t, DATE)).at(-1)!,
      }).expect(409);
      await post('appointments/cancel', patient.token, {
        appointmentId,
      }).expect(409);
    });

    it('even staff cannot cancel a completed visit', async () => {
      const { appointmentId } = await bookFirstSlot(t, patient, DATE);
      await t.db
        .update(appointments)
        .set({ status: 'completed' })
        .where(eq(appointments.id, appointmentId));
      await post('appointments/cancel', tokens.receptionist(), {
        appointmentId,
      }).expect(409);
    });
  });
});
