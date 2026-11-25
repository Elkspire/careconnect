import { and, eq, inArray } from 'drizzle-orm';
import {
  auditLog,
  authUsers,
  clinicStaff,
  notificationLog,
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

const DATE = daysAhead(13);
// One notification_log row per channel; web and Expo push share a name.
const ALL_CHANNELS = ['email', 'in_app', 'push', 'push', 'sms', 'whatsapp'];

/**
 * Vercel can freeze the function once the response is sent, so everything must
 * already be done by then. These look at the log straight after the response.
 */
describe('Work finished before the response (e2e)', () => {
  let t: TestApp;
  let patient: TestUser;
  let waiting: TestUser;

  beforeAll(async () => {
    t = await createTestApp();
    patient = await createPatient(t);
    waiting = await createPatient(t);
  });
  afterEach(() => releaseAppointments(t, [patient.id]));
  afterAll(async () => {
    await t.db
      .delete(waitlistEntries)
      .where(eq(waitlistEntries.patientId, waiting.id));
    await t.close();
  });

  const post = (path: string, token: string, body: object) =>
    t.http().post(path).auth(token, { type: 'bearer' }).send(body).expect(201);

  const channels = async (
    eventType: string,
    by: { appointment: string } | { recipient: string },
  ) => {
    const rows = await t.db
      .select({ channel: notificationLog.channel })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.eventType, eventType),
          'appointment' in by
            ? eq(notificationLog.relatedAppointmentId, by.appointment)
            : eq(notificationLog.recipientUserId, by.recipient),
        ),
      );
    return rows.map((r) => r.channel).sort();
  };

  it('notifications when booking', async () => {
    const { appointmentId } = await bookFirstSlot(t, patient, DATE);
    expect(
      await channels('appointment.booked', { appointment: appointmentId }),
    ).toEqual(ALL_CHANNELS);
  });

  it('notifications when rescheduling', async () => {
    const { appointmentId } = await bookFirstSlot(t, patient, DATE);
    await post('/booking/appointments/reschedule', patient.token, {
      appointmentId,
      scheduledStart: (await openSlots(t, DATE)).at(-1)!,
    });
    expect(
      await channels('appointment.rescheduled', { appointment: appointmentId }),
    ).toEqual(ALL_CHANNELS);
  });

  it('notifications when checking in', async () => {
    const { appointmentId } = await bookFirstSlot(t, patient, DATE);
    await post(`/clinics/${SEED.clinicId}/check-in`, tokens.receptionist(), {
      appointmentId,
    });
    expect(
      await channels('patient.checked_in', { appointment: appointmentId }),
    ).toEqual(ALL_CHANNELS);
  });

  it('notifications when cancelling, including the waitlist offer', async () => {
    const { appointmentId } = await bookFirstSlot(t, patient, DATE);
    await post('/booking/waitlist', waiting.token, {
      subjectType: 'self',
      practitionerId: SEED.doctorId,
      clinicId: SEED.clinicId,
      requestedDate: DATE,
    });
    await post('/booking/appointments/cancel', patient.token, {
      appointmentId,
    });
    expect(
      await channels('appointment.cancelled', { appointment: appointmentId }),
    ).toEqual(ALL_CHANNELS);
    expect(
      await channels('waitlist.offered', { recipient: waiting.id }),
    ).toEqual(ALL_CHANNELS);
  });

  it('the message when inviting staff', async () => {
    const phone = `92300${String(Date.now()).slice(-7)}`;
    try {
      const res = await post(
        `/clinics/${SEED.clinicId}/staff`,
        tokens.doctor(),
        {
          clinicId: SEED.clinicId,
          phone: `+${phone}`,
          fullName: 'E2E Invitee',
          role: 'receptionist',
        },
      );
      const { userId } = res.body as { userId: string };
      expect(await channels('staff.invited', { recipient: userId })).toEqual(
        ALL_CHANNELS,
      );
    } finally {
      const invited = t.db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.phone, phone));
      await t.db
        .delete(clinicStaff)
        .where(inArray(clinicStaff.userId, invited));
    }
  });

  it('the audit entry when writing and reading a clinical note', async () => {
    const { appointmentId } = await bookFirstSlot(t, patient, DATE);
    const notes = `/clinics/${SEED.clinicId}/clinical-notes`;
    const created = await post(notes, tokens.doctor(), {
      appointmentId,
      notes: 'All well',
    });
    const { id: noteId } = created.body as { id: string };
    const entries = async () => {
      const rows = await t.db
        .select({ action: auditLog.action, actor: auditLog.actorUserId })
        .from(auditLog)
        // Creating is logged under the note, reading under the appointment.
        .where(inArray(auditLog.resourceId, [noteId, appointmentId]));
      return rows.sort((a, b) => a.action.localeCompare(b.action));
    };
    const create = { action: 'create', actor: SEED.doctorId };
    expect(await entries()).toEqual([create]);

    await t
      .http()
      .get(`${notes}/${appointmentId}`)
      .auth(tokens.doctor(), { type: 'bearer' })
      .expect(200);
    expect(await entries()).toEqual([
      create,
      { action: 'view', actor: SEED.doctorId },
    ]);
  });

  it('refuses a view, and fails a change, when no audit entry can be saved', async () => {
    const { appointmentId } = await bookFirstSlot(t, patient, DATE);
    const notes = `/clinics/${SEED.clinicId}/clinical-notes`;
    const patch = (text: string) =>
      t
        .http()
        .patch(`${notes}/${appointmentId}`)
        .auth(tokens.doctor(), { type: 'bearer' })
        .send({ notes: text });
    const view = () =>
      t
        .http()
        .get(`${notes}/${appointmentId}`)
        .auth(tokens.doctor(), { type: 'bearer' });
    await post(notes, tokens.doctor(), { appointmentId, notes: 'First' });

    const record = jest
      .spyOn(t.audit, 'record')
      .mockRejectedValue(new Error('database is down'));
    try {
      const refused = await view().expect(503);
      expect(JSON.stringify(refused.body)).not.toContain('First');
      const failed = await patch('Second').expect(500);
      expect((failed.body as { message: string }).message).toContain(
        'was saved',
      );
    } finally {
      record.mockRestore();
    }
    const after = await view().expect(200);
    expect((after.body as { notes: string }).notes).toBe('Second');
  });
});
