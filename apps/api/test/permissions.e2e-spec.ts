import { and, eq } from 'drizzle-orm';
import { clinicStaff, patientAssignments } from '../src/common/database/schema';
import {
  bookFirstSlot,
  createPatient,
  createPractitioner,
  createTestApp,
  daysAhead,
  releaseAppointments,
  SEED,
  type TestApp,
  type TestUser,
  tokens,
} from './support/app';

const CLINIC = `/clinics/${SEED.clinicId}`;

describe('Permissions (e2e)', () => {
  let t: TestApp;
  let juniorDoctor: TestUser;
  let patient: TestUser;
  let appointmentId: string;
  const as: Record<string, () => string> = { ...tokens };

  beforeAll(async () => {
    t = await createTestApp();

    juniorDoctor = await createPractitioner(t, 'Dr Junior');
    await t.db.insert(clinicStaff).values({
      clinicId: SEED.clinicId,
      userId: juniorDoctor.id,
      role: 'junior_doctor',
      status: 'active',
    });
    as.juniorDoctor = () => juniorDoctor.token;

    // A patient this clinic has treated, so patient-scoped routes resolve.
    patient = await createPatient(t, 'Treated Patient');
    ({ appointmentId } = await bookFirstSlot(t, patient, daysAhead(9)));
  });
  afterAll(async () => {
    await releaseAppointments(t, [patient.id]);
    await t.db
      .delete(clinicStaff)
      .where(eq(clinicStaff.userId, juniorDoctor.id));
    await t.close();
  });

  const get = (who: string, path: string) =>
    t.http().get(path).auth(as[who]!(), { type: 'bearer' });

  it('rejects clinic routes without a token', () =>
    t.http().get(`${CLINIC}/today`).expect(401));

  describe('role matrix at the seeded clinic', () => {
    // [route, roles allowed]. Everyone else gets 403.
    const routes: Array<[string, string[]]> = [
      ['/staff', ['doctor']],
      ['/analytics', ['doctor']],
      ['/patient-assignments', ['doctor']],
      ['/practitioner-config', ['doctor']],
      ['/today', ['doctor', 'receptionist', 'juniorDoctor']],
      ['/waitlist', ['doctor', 'receptionist', 'juniorDoctor']],
      ['/patients', ['doctor', 'receptionist', 'juniorDoctor']],
    ];
    const everyone = ['doctor', 'receptionist', 'juniorDoctor', 'patient'];

    for (const [route, allowed] of routes) {
      for (const who of everyone) {
        const status = allowed.includes(who) ? 200 : 403;
        it(`${who} GET ${route} -> ${status}`, () =>
          get(who, `${CLINIC}${route}`).expect(status));
      }
    }

    it.each(['receptionist', 'patient'])(
      '%s cannot read clinical records',
      (who) => get(who, `${CLINIC}/patients/${patient.id}/records`).expect(403),
    );

    it.each(['receptionist', 'patient'])(
      '%s cannot read clinical notes',
      (who) =>
        get(who, `${CLINIC}/clinical-notes/${appointmentId}`).expect(403),
    );

    it('the owner can read clinical records', () =>
      get('doctor', `${CLINIC}/patients/${patient.id}/records`).expect(200));

    it.each(['juniorDoctor', 'patient'])('%s cannot check patients in', (who) =>
      t
        .http()
        .post(`${CLINIC}/check-in`)
        .auth(as[who]!(), { type: 'bearer' })
        .send({ appointmentId })
        .expect(403),
    );

    it.each(['receptionist', 'juniorDoctor', 'patient'])(
      '%s cannot invite staff',
      (who) =>
        t
          .http()
          .post(`${CLINIC}/staff`)
          .auth(as[who]!(), { type: 'bearer' })
          .send({ phone: '+923330000002', role: 'receptionist' })
          .expect(403),
    );

    it.each(['doctor', 'receptionist', 'patient'])(
      '%s is not a platform admin',
      (who) => get(who, '/admin/practitioners').expect(403),
    );
  });

  describe('permission overrides and revoked staff', () => {
    const receptionistRow = and(
      eq(clinicStaff.clinicId, SEED.clinicId),
      eq(clinicStaff.userId, SEED.receptionistId),
    );
    afterEach(async () => {
      await t.db
        .update(clinicStaff)
        .set({ revokedPermissions: [], status: 'active' })
        .where(receptionistRow);
    });

    it('a revoked permission blocks only that permission', async () => {
      await t.db
        .update(clinicStaff)
        .set({ revokedPermissions: ['viewPatientList'] })
        .where(receptionistRow);
      await get('receptionist', `${CLINIC}/patients`).expect(403);
      await get('receptionist', `${CLINIC}/today`).expect(200);
    });

    it('revoked staff lose access entirely', async () => {
      await t.db
        .update(clinicStaff)
        .set({ status: 'revoked' })
        .where(receptionistRow);
      await get('receptionist', `${CLINIC}/today`).expect(403);
    });

    it('the database refuses permission overrides on an owner', async () => {
      const ownerRow = and(
        eq(clinicStaff.clinicId, SEED.clinicId),
        eq(clinicStaff.userId, SEED.doctorId),
      );
      await expect(
        t.db
          .update(clinicStaff)
          .set({ revokedPermissions: ['viewPatientList'] })
          .where(ownerRow),
      ).rejects.toThrow();
    });
  });

  describe('junior doctors only see assigned patients', () => {
    const listedIds = async () => {
      const res = await get('juniorDoctor', `${CLINIC}/patients`).expect(200);
      return (res.body as Array<{ patientId: string }>).map((p) => p.patientId);
    };

    it('hides an unassigned patient, then shows them once assigned', async () => {
      expect(await listedIds()).not.toContain(patient.id);
      await get('juniorDoctor', `${CLINIC}/patients/${patient.id}`).expect(404);
      await get(
        'juniorDoctor',
        `${CLINIC}/patients/${patient.id}/records`,
      ).expect(404);
      await t
        .http()
        .put(`${CLINIC}/appointments/${appointmentId}/vitals`)
        .auth(juniorDoctor.token, { type: 'bearer' })
        .send({ pulseBpm: 72 })
        .expect(404);

      const res = await t
        .http()
        .post(`${CLINIC}/patient-assignments`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .send({ juniorDoctorUserId: juniorDoctor.id, patientId: patient.id })
        .expect(201);
      try {
        expect(await listedIds()).toContain(patient.id);
        await get('juniorDoctor', `${CLINIC}/patients/${patient.id}`).expect(
          200,
        );
      } finally {
        await t.db
          .delete(patientAssignments)
          .where(eq(patientAssignments.id, (res.body as { id: string }).id));
      }
    });

    it('the owner cannot assign a patient the clinic has never treated', async () => {
      const stranger = await createPatient(t, 'Never Visited');
      await t
        .http()
        .post(`${CLINIC}/patient-assignments`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .send({ juniorDoctorUserId: juniorDoctor.id, patientId: stranger.id })
        .expect(404);
    });
  });
});
