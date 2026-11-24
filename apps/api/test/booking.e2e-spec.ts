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

    // Known bug: assertSlotFree compares with <= / >=, so a booking that
    // merely touches an existing one counts as a clash. Availability (which
    // uses strict comparisons) still offers the slot. `it.failing` passes
    // while the bug exists; once it is fixed, swap it for `it`.
    it.failing(
      'allows booking the slot straight after a booked one',
      async () => {
        const [first, second] = await openSlots(t, DATE);
        await book(patient.token, first!).expect(201);
        await book(other.token, second!).expect(201);
      },
    );

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
      // Not the next slot: see the adjacent-booking bug below.
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
  });
});
