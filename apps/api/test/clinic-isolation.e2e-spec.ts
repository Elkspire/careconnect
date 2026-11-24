import { and, eq } from 'drizzle-orm';
import {
  appointments,
  clinicalNotes,
  clinics,
  clinicStaff,
  patientAssignments,
  patientRecords,
  waitlistEntries,
} from '../src/common/database/schema';
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

  const asOwnerB = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
  ) => t.http()[method](path).auth(ownerB.token, { type: 'bearer' });

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

  // Booking routes carry no clinic in the URL, so ClinicRoleGuard never sees
  // them; the service has to make this check itself.
  it("clinic B's owner cannot cancel or move clinic A's appointment", async () => {
    await asOwnerB('post', '/booking/appointments/cancel')
      .send({ appointmentId: appointmentAtA })
      .expect(403);
    await asOwnerB('post', '/booking/appointments/reschedule')
      .send({
        appointmentId: appointmentAtA,
        scheduledStart: new Date(
          `${daysAhead(10)}T20:00:00+05:00`,
        ).toISOString(),
      })
      .expect(403);
  });

  describe("clinic A's files, staff and assignments", () => {
    let recordId: string;
    let assignmentId: string;
    let staffId: string;

    beforeAll(async () => {
      const [record] = await t.db
        .insert(patientRecords)
        .values({
          patientId: patient.id,
          recordType: 'lab_report',
          filePath: `${patient.id}/e2e/file.pdf`,
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
          linkedAppointmentId: appointmentAtA,
          uploadedBy: patient.id,
        })
        .returning();
      recordId = record!.id;
      const [assignment] = await t.db
        .insert(patientAssignments)
        .values({
          clinicId: SEED.clinicId,
          juniorDoctorUserId: SEED.receptionistId,
          patientId: patient.id,
          assignedBy: SEED.doctorId,
        })
        .returning();
      assignmentId = assignment!.id;
      // Without a note to find, the clinical-notes checks below would 404 anyway.
      await t.db.insert(clinicalNotes).values({
        appointmentId: appointmentAtA,
        patientId: patient.id,
        practitionerId: SEED.doctorId,
        notes: 'Original',
        createdBy: SEED.doctorId,
      });
      const [staff] = await t.db
        .select({ id: clinicStaff.id })
        .from(clinicStaff)
        .where(
          and(
            eq(clinicStaff.clinicId, SEED.clinicId),
            eq(clinicStaff.userId, SEED.receptionistId),
          ),
        );
      staffId = staff!.id;
    });
    afterAll(async () => {
      await t.db
        .delete(clinicalNotes)
        .where(eq(clinicalNotes.appointmentId, appointmentAtA));
      await t.db
        .delete(patientAssignments)
        .where(eq(patientAssignments.id, assignmentId));
      await t.db.delete(patientRecords).where(eq(patientRecords.id, recordId));
      await t.db
        .update(clinicStaff)
        .set({ status: 'active' })
        .where(eq(clinicStaff.id, staffId));
    });

    it("clinic A's owner sees the record (control)", async () => {
      const res = await t
        .http()
        .get(`${A}/patients/${patient.id}/records`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .expect(200);
      expect(res.body).toContainEqual(
        expect.objectContaining({ id: recordId }),
      );
    });

    it("clinic B's owner cannot open the file through either clinic", async () => {
      await asOwnerB('get', `${A}/records/${recordId}/signed-url`).expect(403);
      await asOwnerB('get', `${B()}/records/${recordId}/signed-url`).expect(
        404,
      );
    });

    it('cannot attach a file to the appointment', () =>
      asOwnerB('post', `${B()}/records`)
        .field('appointmentId', appointmentAtA)
        .field('recordType', 'lab_report')
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'x.pdf',
          contentType: 'application/pdf',
        })
        .expect(404));

    it('cannot remove staff, whichever clinic is in the URL', async () => {
      await asOwnerB('delete', `${A}/staff/${staffId}`).expect(403);
      await asOwnerB('delete', `${B()}/staff/${staffId}`).expect(404);
      const [row] = await t.db
        .select({ status: clinicStaff.status })
        .from(clinicStaff)
        .where(eq(clinicStaff.id, staffId));
      expect(row?.status).toBe('active');
    });

    it('cannot remove an assignment, whichever clinic is in the URL', async () => {
      const path = `/patient-assignments/${assignmentId}`;
      await asOwnerB('delete', `${A}${path}`).expect(403);
      await asOwnerB('delete', `${B()}${path}`).expect(404);
      const rows = await t.db
        .select({ id: patientAssignments.id })
        .from(patientAssignments)
        .where(eq(patientAssignments.id, assignmentId));
      expect(rows).toHaveLength(1);
    });

    it("cannot assign anyone clinic A's patient", () =>
      asOwnerB('post', `${B()}/patient-assignments`)
        .send({
          juniorDoctorUserId: SEED.receptionistId,
          patientId: patient.id,
        })
        .expect(404));

    it("clinic A's owner can read the note (control)", () =>
      t
        .http()
        .get(`${A}/clinical-notes/${appointmentAtA}`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .expect(200));

    it.each(['', '/allergies', '/prescription'])(
      'cannot read the clinical note%s',
      (suffix) =>
        asOwnerB(
          'get',
          `${B()}/clinical-notes/${appointmentAtA}${suffix}`,
        ).expect(404),
    );

    it('cannot edit a note or prescription for the visit', async () => {
      await asOwnerB('patch', `${B()}/clinical-notes/${appointmentAtA}`)
        .send({ notes: 'Changed' })
        .expect(404);
      await asOwnerB(
        'post',
        `${B()}/clinical-notes/${appointmentAtA}/prescription`,
      )
        .send({ items: [{ drugName: 'Aspirin' }] })
        .expect(404);
      const [row] = await t.db
        .select({ notes: clinicalNotes.notes })
        .from(clinicalNotes)
        .where(eq(clinicalNotes.appointmentId, appointmentAtA));
      expect(row?.notes).toBe('Original');
    });

    it("clinic B's own lists contain nothing of clinic A's", async () => {
      const [entry] = await t.db
        .insert(waitlistEntries)
        .values({
          patientId: patient.id,
          practitionerId: SEED.doctorId,
          clinicId: SEED.clinicId,
          requestedDate: daysAhead(10),
        })
        .returning();
      try {
        for (const route of [
          '/today',
          '/waitlist',
          '/patient-assignments',
          '/appointments/recent',
        ]) {
          const res = await asOwnerB('get', `${B()}${route}`).expect(200);
          expect(res.body).toEqual([]);
        }
        const staff = await asOwnerB('get', `${B()}/staff`).expect(200);
        expect(
          (staff.body as Array<{ userId: string }>).map((s) => s.userId),
        ).toEqual([ownerB.id]);
        const analytics = await asOwnerB('get', `${B()}/analytics`).expect(200);
        expect(analytics.body).toMatchObject({
          daily: [],
          byPractitioner: [],
          totals: { visits: 0, uniquePatients: 0 },
        });
      } finally {
        await t.db
          .delete(waitlistEntries)
          .where(eq(waitlistEntries.id, entry!.id));
      }
    });

    it('a role at one clinic does not carry over to another', async () => {
      const [row] = await t.db
        .insert(clinicStaff)
        .values({
          clinicId: SEED.clinicId,
          userId: ownerB.id,
          role: 'receptionist',
          status: 'active',
        })
        .returning();
      try {
        // Owner at B, only a receptionist at A.
        await asOwnerB('get', `${A}/today`).expect(200);
        await asOwnerB('get', `${A}/staff`).expect(403);
        await asOwnerB('get', `${A}/patients/${patient.id}/records`).expect(
          403,
        );
        await asOwnerB('get', `${B()}/staff`).expect(200);
      } finally {
        await t.db.delete(clinicStaff).where(eq(clinicStaff.id, row!.id));
      }
    });

    it('another patient cannot reach the file', async () => {
      const stranger = await createPatient(t, 'Stranger');
      const asStranger = (method: 'get' | 'delete', path: string) =>
        t.http()[method](path).auth(stranger.token, { type: 'bearer' });

      const list = await asStranger('get', '/vault/records').expect(200);
      expect(list.body).toEqual([]);
      await asStranger('get', `/vault/records/${recordId}/signed-url`).expect(
        404,
      );
      await asStranger('delete', `/vault/records/${recordId}`).expect(404);
      const rows = await t.db
        .select({ id: patientRecords.id })
        .from(patientRecords)
        .where(eq(patientRecords.id, recordId));
      expect(rows).toHaveLength(1);
    });
  });
});
