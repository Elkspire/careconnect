import { eq } from 'drizzle-orm';
import { appointments, clinics } from '../src/common/database/schema';
import {
  bookFirstSlot,
  createClinicWithOwner,
  createPatient,
  createTestApp,
  daysAhead,
  releaseAppointments,
  SEED,
  type TestApp,
  type TestUser,
  tokens,
} from './support/app';

/**
 * Two clinics with different owners. A patient has only ever visited the
 * seeded clinic (A). Nobody at clinic B may see or act on anything of A's,
 * whether by calling A's routes or by passing A's ids to B's routes.
 */
describe('Clinic data isolation (e2e)', () => {
  let t: TestApp;
  let ownerB: TestUser;
  let clinicB: string;
  let patient: TestUser;
  let appointmentAtA: string;

  const A = `/clinics/${SEED.clinicId}`;
  const B = () => `/clinics/${clinicB}`;

  beforeAll(async () => {
    t = await createTestApp();
    ({ owner: ownerB, clinicId: clinicB } = await createClinicWithOwner(t));
    patient = await createPatient(t, 'Clinic A Patient');
    ({ appointmentId: appointmentAtA } = await bookFirstSlot(
      t,
      patient,
      daysAhead(10),
    ));
  });
  afterAll(async () => {
    await releaseAppointments(t, [patient.id]);
    await t.db.delete(clinics).where(eq(clinics.id, clinicB));
    await t.close();
  });

  const asOwnerB = (method: 'get' | 'post' | 'put', path: string) =>
    t.http()[method](path).auth(ownerB.token, { type: 'bearer' });

  it("clinic A's owner sees the patient (control)", async () => {
    const res = await t
      .http()
      .get(`${A}/patients`)
      .auth(tokens.doctor(), { type: 'bearer' })
      .expect(200);
    expect(res.body).toContainEqual(
      expect.objectContaining({ patientId: patient.id }),
    );
  });

  describe("clinic B's owner calling clinic A's routes", () => {
    it.each([
      '/patients',
      '/today',
      '/waitlist',
      '/staff',
      '/analytics',
      '/patient-assignments',
    ])('GET %s -> 403', (route) => asOwnerB('get', `${A}${route}`).expect(403));

    it('cannot open the patient, their records or notes -> 403', async () => {
      await asOwnerB('get', `${A}/patients/${patient.id}`).expect(403);
      await asOwnerB('get', `${A}/patients/${patient.id}/records`).expect(403);
      await asOwnerB('get', `${A}/clinical-notes/${appointmentAtA}`).expect(
        403,
      );
    });

    it('cannot check the patient in -> 403', () =>
      asOwnerB('post', `${A}/check-in`)
        .send({ appointmentId: appointmentAtA })
        .expect(403));
  });

  describe("clinic B's owner passing clinic A's ids to clinic B's routes", () => {
    it("does not list clinic A's patient", async () => {
      const res = await asOwnerB('get', `${B()}/patients`).expect(200);
      expect(res.body).toEqual([]);
    });

    it.each(['', '/records', '/medical-summary'])(
      'GET /patients/:id%s -> 404',
      (suffix) =>
        asOwnerB('get', `${B()}/patients/${patient.id}${suffix}`).expect(404),
    );

    it('cannot check in an appointment at clinic A', () =>
      asOwnerB('post', `${B()}/check-in`)
        .send({ appointmentId: appointmentAtA })
        .expect(403));

    it('cannot record or read vitals for it', async () => {
      await asOwnerB('put', `${B()}/appointments/${appointmentAtA}/vitals`)
        .send({ pulseBpm: 72 })
        .expect(404);
      await asOwnerB(
        'get',
        `${B()}/appointments/${appointmentAtA}/vitals`,
      ).expect(404);
    });

    it('cannot write or read a clinical note for it', async () => {
      await asOwnerB('post', `${B()}/clinical-notes`)
        .send({ appointmentId: appointmentAtA, notes: 'Not my patient' })
        .expect(403);
      await asOwnerB('get', `${B()}/clinical-notes/${appointmentAtA}`).expect(
        404,
      );
    });

    it('cannot write to the medical summary', () =>
      asOwnerB('put', `${B()}/patients/${patient.id}/medical-summary`)
        .send({ allergies: ['Penicillin'] })
        .expect(404));

    it('the appointment is left untouched', async () => {
      const [row] = await t.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentAtA));
      expect(row?.status).toBe('booked');
    });
  });

  it.each(['doctor', 'receptionist'] as const)(
    "clinic A's %s cannot reach clinic B -> 403",
    async (who) => {
      await t
        .http()
        .get(`${B()}/patients`)
        .auth(tokens[who](), { type: 'bearer' })
        .expect(403);
      await t
        .http()
        .get(`${B()}/today`)
        .auth(tokens[who](), { type: 'bearer' })
        .expect(403);
    },
  );
});
