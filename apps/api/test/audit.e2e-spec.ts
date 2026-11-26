import { and, eq, inArray } from 'drizzle-orm';
import {
  appointments,
  auditLog,
  clinicStaff,
  familyMembers,
  patientAssignments,
  patientRecords,
} from '../src/common/database/schema';
import {
  bookFirstSlot,
  createPatient,
  createPractitioner,
  createTestApp,
  daysAhead,
  openSlots,
  releaseAppointments,
  SEED,
  type TestApp,
  type TestUser,
  tokens,
} from './support/app';

const CLINIC = `/clinics/${SEED.clinicId}`;
const PDF = { filename: 'report.pdf', contentType: 'application/pdf' };

type Method = 'get' | 'put' | 'post' | 'patch' | 'delete';
type Step = [
  what: string,
  method: Method,
  path: () => string,
  entry: { action: string; resourceType: string; resourceId?: () => string },
  body?: object,
];

describe('Audit log (e2e)', () => {
  let t: TestApp;
  let patient: TestUser;
  let junior: TestUser;
  let appointmentId: string;
  let familyMemberId: string;
  let recordId: string;

  beforeAll(async () => {
    t = await createTestApp();
    patient = await createPatient(t, 'Audited Patient');
    junior = await createPractitioner(t, 'Dr Junior');
    await t.db.insert(clinicStaff).values({
      clinicId: SEED.clinicId,
      userId: junior.id,
      role: 'junior_doctor',
      status: 'active',
    });
    const date = daysAhead(14);
    ({ appointmentId } = await bookFirstSlot(t, patient, date));
    const [member] = await t.db
      .insert(familyMembers)
      .values({ patientId: patient.id, fullName: 'Kid', relationship: 'son' })
      .returning();
    familyMemberId = member!.id;
    await t
      .http()
      .post('/booking/appointments')
      .auth(patient.token, { type: 'bearer' })
      .send({
        subjectType: 'family_member',
        familyMemberId,
        practitionerId: SEED.doctorId,
        clinicId: SEED.clinicId,
        scheduledStart: (await openSlots(t, date)).at(-1)!,
      })
      .expect(201);
    await t.db.insert(patientAssignments).values(
      [null, familyMemberId].map((id) => ({
        clinicId: SEED.clinicId,
        juniorDoctorUserId: junior.id,
        patientId: patient.id,
        familyMemberId: id,
        assignedBy: SEED.doctorId,
      })),
    );
    const upload = await t
      .http()
      .post('/vault/records')
      .auth(patient.token, { type: 'bearer' })
      .field('subjectType', 'self')
      .field('recordType', 'lab_report')
      .attach('file', Buffer.from('%PDF-1.4'), PDF)
      .expect(201);
    recordId = (upload.body as { id: string }).id;
  });
  afterAll(async () => {
    await releaseAppointments(t, [patient.id]);
    await t.db.delete(clinicStaff).where(eq(clinicStaff.userId, junior.id));
    await t.close();
  });

  /** Everything logged about this patient since the last call. */
  const seen = new Set<string>();
  const newEntries = async () => {
    const rows = await t.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.patientId, patient.id));
    const fresh = rows.filter((r) => !seen.has(r.id));
    fresh.forEach((r) => seen.add(r.id));
    return fresh;
  };

  const PATIENT = () => `${CLINIC}/patients/${patient.id}`;
  const FAMILY = () => `${PATIENT()}/family/${familyMemberId}`;
  const VITALS = () => `${CLINIC}/appointments/${appointmentId}/vitals`;
  const NOTE = () => `${CLINIC}/clinical-notes/${appointmentId}`;
  const view = (resourceType: string, resourceId?: () => string) => ({
    action: 'view',
    resourceType,
    resourceId,
  });
  const update = (resourceType: string, resourceId?: () => string) => ({
    action: 'update',
    resourceType,
    resourceId,
  });
  const visit = () => appointmentId;
  const summary = { allergies: ['Penicillin'] };

  const steps: Step[] = [
    [
      'record list',
      'get',
      () => `${PATIENT()}/records`,
      view('patient_record'),
    ],
    [
      'family record list',
      'get',
      () => `${FAMILY()}/records`,
      view('patient_record'),
    ],
    [
      'opened record',
      'get',
      () => `${CLINIC}/records/${recordId}/signed-url`,
      view('patient_record', () => recordId),
    ],
    [
      'summary change',
      'put',
      () => `${PATIENT()}/medical-summary`,
      update('medical_summary'),
      summary,
    ],
    [
      'summary',
      'get',
      () => `${PATIENT()}/medical-summary`,
      view('medical_summary'),
    ],
    [
      'family summary change',
      'put',
      () => `${FAMILY()}/medical-summary`,
      update('medical_summary'),
      summary,
    ],
    [
      'family summary',
      'get',
      () => `${FAMILY()}/medical-summary`,
      view('medical_summary'),
    ],
    ['vitals that are not there yet', 'get', VITALS, view('vitals', visit)],
    ['vitals change', 'put', VITALS, update('vitals', visit), { pulseBpm: 72 }],
    ['vitals', 'get', VITALS, view('vitals', visit)],
    [
      'allergies',
      'get',
      () => `${NOTE()}/allergies`,
      view('clinical_note', visit),
    ],
  ];

  describe.each([
    ['owner', () => ({ id: SEED.doctorId, token: tokens.doctor() })],
    ['junior_doctor', () => junior],
  ] as const)('%s', (role, user) => {
    // The body is named for every row: Jest fills a missing column with `done`.
    it.each(
      steps.map(([what, method, path, entry, body]) => ({
        what,
        method,
        path,
        entry,
        body,
      })),
    )('$what', async ({ method, path, entry, body }) => {
      await newEntries();
      await t
        .http()
        [method](path())
        .auth(user().token, { type: 'bearer' })
        .send(body)
        .expect(200);

      const entries = await newEntries();
      expect(entries).toEqual([
        expect.objectContaining({
          actorUserId: user().id,
          actorRole: role,
          action: entry.action,
          resourceType: entry.resourceType,
          clinicId: SEED.clinicId,
          patientId: patient.id,
          metadata: path().includes('/family/') ? { familyMemberId } : {},
        }),
      ]);
      if (entry.resourceId) {
        expect(entries[0]!.resourceId).toBe(entry.resourceId());
      }
    });

    it('attached file', async () => {
      await newEntries();
      const res = await t
        .http()
        .post(`${CLINIC}/records`)
        .auth(user().token, { type: 'bearer' })
        .field('appointmentId', appointmentId)
        .field('recordType', 'lab_report')
        .attach('file', Buffer.from('%PDF-1.4'), PDF)
        .expect(201);
      expect(await newEntries()).toEqual([
        expect.objectContaining({
          actorUserId: user().id,
          actorRole: role,
          action: 'create',
          resourceType: 'patient_record',
          resourceId: (res.body as { id: string }).id,
          patientId: patient.id,
        }),
      ]);
    });
  });

  it('the patient opening and deleting their own file names them as the patient', async () => {
    await newEntries();
    const as = (method: 'get' | 'delete', path: string) =>
      t
        .http()
        [method](path)
        .auth(patient.token, { type: 'bearer' })
        .expect(200);
    await as('get', `/vault/records/${recordId}/signed-url`);
    await as('delete', `/vault/records/${recordId}`);
    const entries = await newEntries();
    expect(entries.map((e) => e.action).sort()).toEqual(['delete', 'view']);
    for (const entry of entries) {
      expect(entry).toMatchObject({
        actorUserId: patient.id,
        actorRole: 'patient',
        resourceId: recordId,
      });
    }
  });

  it('a refused request leaves no entry', async () => {
    await newEntries();
    for (const path of [`${PATIENT()}/records`, VITALS()]) {
      await t
        .http()
        .get(path)
        .auth(tokens.receptionist(), { type: 'bearer' })
        .expect(403);
    }
    expect(await newEntries()).toEqual([]);
  });

  describe('when an entry cannot be saved', () => {
    let record: jest.SpyInstance;
    beforeEach(() => {
      record = jest
        .spyOn(t.audit, 'record')
        .mockRejectedValue(new Error('database is down'));
    });
    afterEach(() => record.mockRestore());

    const call = (method: Method, path: string, body?: object) =>
      t
        .http()
        [method](path)
        .auth(tokens.doctor(), { type: 'bearer' })
        .send(body);

    it.each([
      ['records', () => `${PATIENT()}/records`],
      ['medical summary', () => `${PATIENT()}/medical-summary`],
      ['vitals', VITALS],
    ])(
      '%s are refused, with the code the web app looks for',
      async (_n, path) => {
        const res = await call('get', path()).expect(503);
        expect(res.body).toEqual({
          statusCode: 503,
          code: 'audit_view_refused',
          message: expect.any(String) as string,
        });
      },
    );

    it('a change is saved but reported', async () => {
      const res = await call('put', VITALS(), { pulseBpm: 99 }).expect(500);
      expect(res.body).toMatchObject({ code: 'audit_change_saved' });
      record.mockRestore();
      const after = await call('get', VITALS()).expect(200);
      expect(after.body).toMatchObject({ pulseBpm: 99 });
    });

    it('a prescription still comes back with its allergy warnings, and nothing else', async () => {
      record.mockRestore();
      await call('put', `${PATIENT()}/medical-summary`, summary).expect(200);
      await call('post', `${CLINIC}/clinical-notes`, {
        appointmentId,
        notes: 'Sore throat',
      }).expect(201);
      record = jest
        .spyOn(t.audit, 'record')
        .mockRejectedValue(new Error('database is down'));

      const save = (drugName: string) =>
        call('post', `${NOTE()}/prescription`, {
          items: [{ drugName }],
        }).expect(500);
      const failure = {
        statusCode: 500,
        code: 'audit_change_saved',
        message: expect.any(String) as string,
      };
      expect((await save('Paracetamol')).body).toEqual({
        ...failure,
        allergyWarnings: [],
      });
      expect((await save('Penicillin V')).body).toEqual({
        ...failure,
        allergyWarnings: ['Penicillin V'],
      });

      record.mockRestore();
      const after = await call('get', `${NOTE()}/prescription`).expect(200);
      expect(after.body).toEqual([
        expect.objectContaining({ drugName: 'Penicillin V' }),
      ]);
    });

    it('an uploaded file is saved but reported', async () => {
      const mine = () =>
        t.db
          .select({ id: patientRecords.id })
          .from(patientRecords)
          .innerJoin(
            appointments,
            eq(appointments.id, patientRecords.linkedAppointmentId),
          )
          .where(
            and(
              inArray(patientRecords.patientId, [patient.id]),
              eq(appointments.id, appointmentId),
            ),
          );
      const before = (await mine()).length;
      const res = await t
        .http()
        .post(`${CLINIC}/records`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .field('appointmentId', appointmentId)
        .field('recordType', 'lab_report')
        .attach('file', Buffer.from('%PDF-1.4'), PDF)
        .expect(500);
      expect(res.body).toMatchObject({ code: 'audit_change_saved' });
      expect(await mine()).toHaveLength(before + 1);
    });
  });
});
