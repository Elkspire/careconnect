import { and, eq } from 'drizzle-orm';
import {
  appointments,
  clinicalNotes,
  clinicStaff,
  patientAssignments,
  platformAdmins,
  vitals,
  waitlistEntries,
} from '../src/common/database/schema';
import {
  bookFirstSlot,
  createPatient,
  createPractitioner,
  createTestApp,
  createUser,
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

  describe('an assigned junior doctor', () => {
    const records = () => `${CLINIC}/patients/${patient.id}/records`;
    const note = () => `${CLINIC}/clinical-notes/${appointmentId}`;
    const juniorRow = () =>
      and(
        eq(clinicStaff.clinicId, SEED.clinicId),
        eq(clinicStaff.userId, juniorDoctor.id),
      );
    const assign = () =>
      t
        .http()
        .post(`${CLINIC}/patient-assignments`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .send({ juniorDoctorUserId: juniorDoctor.id, patientId: patient.id });
    let assignmentId: string;

    beforeEach(async () => {
      const res = await assign().expect(201);
      assignmentId = (res.body as { id: string }).id;
    });
    afterEach(async () => {
      await t.db
        .delete(patientAssignments)
        .where(eq(patientAssignments.juniorDoctorUserId, juniorDoctor.id));
      await t.db
        .delete(clinicalNotes)
        .where(eq(clinicalNotes.appointmentId, appointmentId));
      await t.db.delete(vitals).where(eq(vitals.appointmentId, appointmentId));
      await t.db
        .update(clinicStaff)
        .set({ revokedPermissions: [] })
        .where(juniorRow());
    });

    it('can read records and record vitals', async () => {
      await get('juniorDoctor', records()).expect(200);
      await t
        .http()
        .put(`${CLINIC}/appointments/${appointmentId}/vitals`)
        .auth(juniorDoctor.token, { type: 'bearer' })
        .send({ pulseBpm: 72 })
        .expect(200);
      const res = await get(
        'doctor',
        `${CLINIC}/appointments/${appointmentId}/vitals`,
      ).expect(200);
      expect(res.body).toMatchObject({
        pulseBpm: 72,
        recordedBy: juniorDoctor.id,
      });
    });

    it('writes notes under the treating doctor, who can read them', async () => {
      await t
        .http()
        .post(`${CLINIC}/clinical-notes`)
        .auth(juniorDoctor.token, { type: 'bearer' })
        .send({ appointmentId, notes: 'Seen by junior' })
        .expect(201);
      const res = await get('doctor', note()).expect(200);
      expect(res.body).toMatchObject({
        practitionerId: SEED.doctorId,
        createdBy: juniorDoctor.id,
      });
      await get('receptionist', note()).expect(403);
    });

    it('loses only the permission that is revoked', async () => {
      await t.db
        .update(clinicStaff)
        .set({ revokedPermissions: ['viewRecords'] })
        .where(juniorRow());
      await get('juniorDoctor', records()).expect(403);
      await get('juniorDoctor', `${CLINIC}/patients/${patient.id}`).expect(200);
    });

    it('loses the patient, and their notes, once unassigned', async () => {
      await t
        .http()
        .post(`${CLINIC}/clinical-notes`)
        .auth(juniorDoctor.token, { type: 'bearer' })
        .send({ appointmentId, notes: 'Seen by junior' })
        .expect(201);
      await t
        .http()
        .delete(`${CLINIC}/patient-assignments/${assignmentId}`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .expect(200);
      await get('juniorDoctor', records()).expect(404);
      await get('juniorDoctor', note()).expect(404);
    });

    it('cannot be assigned the same patient twice', () => assign().expect(409));
  });

  describe('cancelling a patient’s appointment', () => {
    const cancel = (who: string) =>
      t
        .http()
        .post('/booking/appointments/cancel')
        .auth(as[who]!(), { type: 'bearer' })
        .send({ appointmentId });
    const receptionistRow = and(
      eq(clinicStaff.clinicId, SEED.clinicId),
      eq(clinicStaff.userId, SEED.receptionistId),
    );

    it('is not for junior doctors', () => cancel('juniorDoctor').expect(403));

    it('is not for a receptionist who may not check patients in', async () => {
      await t.db
        .update(clinicStaff)
        .set({ revokedPermissions: ['checkInPatients'] })
        .where(receptionistRow);
      try {
        await cancel('receptionist').expect(403);
      } finally {
        await t.db
          .update(clinicStaff)
          .set({ revokedPermissions: [] })
          .where(receptionistRow);
      }
    });
  });

  describe('today and the waitlist, for a junior doctor', () => {
    const idsIn = async (who: string, route: string) => {
      const res = await get(who, `${CLINIC}${route}`).expect(200);
      return (res.body as Array<{ patientId: string }>).map((r) => r.patientId);
    };

    it('only contain assigned patients', async () => {
      // listToday's day is the database's (UTC) one; noon is safely inside it.
      const noon = new Date(`${daysAhead(0)}T12:00:00Z`);
      const [visit] = await t.db
        .insert(appointments)
        .values({
          patientId: patient.id,
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          scheduledStart: noon,
          scheduledEnd: new Date(noon.getTime() + 20 * 60_000),
          status: 'checked_in',
        })
        .returning();
      const [entry] = await t.db
        .insert(waitlistEntries)
        .values({
          patientId: patient.id,
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          requestedDate: daysAhead(9),
        })
        .returning();
      try {
        for (const route of ['/today', '/waitlist']) {
          expect(await idsIn('receptionist', route)).toContain(patient.id);
          expect(await idsIn('juniorDoctor', route)).not.toContain(patient.id);
        }
        await t.db.insert(patientAssignments).values({
          clinicId: SEED.clinicId,
          juniorDoctorUserId: juniorDoctor.id,
          patientId: patient.id,
          assignedBy: SEED.doctorId,
        });
        for (const route of ['/today', '/waitlist']) {
          expect(await idsIn('juniorDoctor', route)).toContain(patient.id);
        }
      } finally {
        await t.db
          .delete(patientAssignments)
          .where(eq(patientAssignments.juniorDoctorUserId, juniorDoctor.id));
        await t.db
          .delete(waitlistEntries)
          .where(eq(waitlistEntries.id, entry!.id));
        await t.db.delete(appointments).where(eq(appointments.id, visit!.id));
      }
    });
  });

  describe('check-in', () => {
    const checkIn = (who: string, id: string) =>
      t
        .http()
        .post(`${CLINIC}/check-in`)
        .auth(as[who]!(), { type: 'bearer' })
        .send({ appointmentId: id });

    it('the receptionist can check a patient in, once', async () => {
      const visit = await bookFirstSlot(t, patient, daysAhead(11));
      await checkIn('receptionist', visit.appointmentId).expect(201);
      await checkIn('receptionist', visit.appointmentId).expect(400);
    });

    it('cannot check in a cancelled appointment', async () => {
      const visit = await bookFirstSlot(t, patient, daysAhead(12));
      await t.db
        .update(appointments)
        .set({ status: 'cancelled' })
        .where(eq(appointments.id, visit.appointmentId));
      await checkIn('receptionist', visit.appointmentId).expect(400);
    });
  });

  describe('staff management', () => {
    const invite = (body: object) =>
      t
        .http()
        .post(`${CLINIC}/staff`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .send({
          clinicId: SEED.clinicId,
          phone: '+923330000003',
          fullName: 'E2E Invitee',
          ...body,
        });

    it('cannot invite a second owner', () =>
      invite({ role: 'owner' }).expect(400));

    it('cannot deny a permission the role never had', () =>
      invite({
        role: 'receptionist',
        deniedPermissions: ['clinicalNotes'],
      }).expect(400));

    it('cannot invite a junior doctor who has no practitioner profile', () =>
      invite({ role: 'junior_doctor' }).expect(400));

    it('the owner cannot lose their own access', async () => {
      const owner = and(
        eq(clinicStaff.clinicId, SEED.clinicId),
        eq(clinicStaff.userId, SEED.doctorId),
      );
      const [row] = await t.db
        .select({ id: clinicStaff.id })
        .from(clinicStaff)
        .where(owner);
      try {
        await invite({ phone: '+923001234567', role: 'receptionist' }).expect(
          409,
        );
        await t
          .http()
          .delete(`${CLINIC}/staff/${row!.id}`)
          .auth(tokens.doctor(), { type: 'bearer' })
          .expect(404);
        await get('doctor', `${CLINIC}/staff`).expect(200);
      } finally {
        await t.db
          .update(clinicStaff)
          .set({ role: 'owner', status: 'active' })
          .where(owner);
      }
    });

    it('an invited member has no access until active, or after removal', async () => {
      const user = await createUser();
      const [row] = await t.db
        .insert(clinicStaff)
        .values({
          clinicId: SEED.clinicId,
          userId: user.id,
          role: 'receptionist',
          status: 'invited',
        })
        .returning();
      as.newcomer = () => user.token;
      try {
        await get('newcomer', `${CLINIC}/today`).expect(403);
        await t.db
          .update(clinicStaff)
          .set({ status: 'active' })
          .where(eq(clinicStaff.id, row!.id));
        await get('newcomer', `${CLINIC}/today`).expect(200);
        await t
          .http()
          .delete(`${CLINIC}/staff/${row!.id}`)
          .auth(tokens.doctor(), { type: 'bearer' })
          .expect(200);
        await get('newcomer', `${CLINIC}/today`).expect(403);
      } finally {
        delete as.newcomer;
        await t.db.delete(clinicStaff).where(eq(clinicStaff.id, row!.id));
      }
    });
  });

  it('rejects a forged token', () =>
    t
      .http()
      .get(`${CLINIC}/today`)
      .auth('not.a.token', { type: 'bearer' })
      .expect(401));

  it('a platform admin can reach admin routes, but no clinic', async () => {
    const admin = await createUser();
    await t.db.insert(platformAdmins).values({ id: admin.id });
    as.admin = () => admin.token;
    try {
      await get('admin', '/admin/practitioners').expect(200);
      await get('admin', `${CLINIC}/patients`).expect(403);
    } finally {
      delete as.admin;
      await t.db.delete(platformAdmins).where(eq(platformAdmins.id, admin.id));
    }
  });
});
