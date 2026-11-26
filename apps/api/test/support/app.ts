import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { ZodValidationPipe } from 'nestjs-zod';
import { and, inArray } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import {
  DRIZZLE,
  type Database,
} from '../../src/common/database/database.module';
import { appointments } from '../../src/common/database/schema';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { AuditLogService } from '../../src/modules/audit/audit.service';

/** Fixed ids from supabase/seed/seed.sql. */
export const SEED = {
  doctorId: '11111111-1111-1111-1111-111111111111',
  patientId: '22222222-2222-2222-2222-222222222222',
  receptionistId: '33333333-3333-3333-3333-333333333333',
  clinicId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  specialtyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};

/** Access tokens for the seeded users, from global-setup.ts. */
export const tokens = {
  doctor: () => process.env.E2E_DOCTOR_TOKEN!,
  patient: () => process.env.E2E_PATIENT_TOKEN!,
  receptionist: () => process.env.E2E_RECEPTIONIST_TOKEN!,
};

type TestDb = Database & { $client: { end: () => Promise<void> } };

export interface TestApp {
  audit: AuditLogService;
  db: TestDb;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

export async function createTestApp(): Promise<TestApp> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Last line of defence before anything opens a connection.
  const config = module.get(ConfigService);
  for (const key of ['DATABASE_URL', 'SUPABASE_URL']) {
    const { hostname } = new URL(config.getOrThrow<string>(key));
    if (!LOCAL_HOSTS.includes(hostname)) {
      throw new Error(`Refusing to run e2e tests: ${key} is ${hostname}`);
    }
  }

  const app = module.createNestApplication<INestApplication<App>>();
  // Same as main.ts.
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  const db = app.get<TestDb>(DRIZZLE);

  return {
    audit: app.get(AuditLogService),
    db,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
      await db.$client.end();
    },
  };
}

const supabase = (key: string) =>
  createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export interface TestUser {
  id: string;
  token: string;
}

/** A throwaway signed-in account, so tests don't share data. */
export async function createUser(): Promise<TestUser> {
  const credentials = {
    email: `e2e-${randomUUID()}@example.com`,
    password: randomUUID(),
  };
  const created = await supabase(
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ).auth.admin.createUser({ ...credentials, email_confirm: true });
  if (created.error) throw created.error;

  const { data, error } = await supabase(
    process.env.E2E_ANON_KEY!,
  ).auth.signInWithPassword(credentials);
  if (error) throw error;
  return { id: data.user.id, token: data.session.access_token };
}

export async function createPatient(
  t: TestApp,
  fullName = 'E2E Patient',
): Promise<TestUser> {
  const user = await createUser();
  await t
    .http()
    .put('/patients/me')
    .auth(user.token, { type: 'bearer' })
    .send({ fullName, preferredLanguage: 'en' })
    .expect(200);
  return user;
}

/** A throwaway practitioner, not yet verified or attached to any clinic. */
export async function createPractitioner(
  t: TestApp,
  fullName = 'Dr E2E',
): Promise<TestUser> {
  const user = await createUser();
  await t
    .http()
    .post('/practitioners/me')
    .auth(user.token, { type: 'bearer' })
    .send({
      fullName,
      gender: 'female',
      practitionerType: 'doctor',
      councilRegistrationNo: `E2E-${randomUUID().slice(0, 8)}`,
      languages: ['en'],
      specialtyIds: [SEED.specialtyId],
    })
    .expect(201);
  return user;
}

/** A practitioner who owns a brand new clinic of their own. */
export async function createClinicWithOwner(
  t: TestApp,
): Promise<{ owner: TestUser; clinicId: string }> {
  const owner = await createPractitioner(t, 'Dr Other Clinic');
  const res = await t
    .http()
    .post('/clinics')
    .auth(owner.token, { type: 'bearer' })
    .send({
      name: `E2E Clinic ${randomUUID().slice(0, 8)}`,
      city: 'Lahore',
      area: 'DHA',
      address: '1 Test Road',
    })
    .expect(201);
  return { owner, clinicId: (res.body as { id: string }).id };
}

/**
 * Frees the slots held by these patients' appointments.
 */
export async function releaseAppointments(
  t: TestApp,
  patientIds: string[],
): Promise<void> {
  await t.db
    .update(appointments)
    .set({ status: 'cancelled' })
    .where(
      and(
        inArray(appointments.patientId, patientIds),
        inArray(appointments.status, ['booked', 'checked_in']),
      ),
    );
}

/** A date far enough ahead to clear any clinic's cancellation window. */
export function daysAhead(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Open slot start times for the seeded doctor at the seeded clinic. */
export async function openSlots(t: TestApp, date: string): Promise<string[]> {
  const res = await t
    .http()
    .get('/booking/availability')
    .query({
      practitionerId: SEED.doctorId,
      clinicId: SEED.clinicId,
      fromDate: date,
      toDate: date,
    })
    .expect(200);
  const days = res.body as Array<{ slots: Array<{ start: string }> }>;
  return days[0]!.slots.map((s) => s.start);
}

/** Books the first open slot on `date` for `user`, at the seeded clinic. */
export async function bookFirstSlot(
  t: TestApp,
  user: TestUser,
  date: string,
): Promise<{ appointmentId: string; slot: string }> {
  const slot = (await openSlots(t, date))[0]!;
  const res = await t
    .http()
    .post('/booking/appointments')
    .auth(user.token, { type: 'bearer' })
    .send({
      subjectType: 'self',
      practitionerId: SEED.doctorId,
      clinicId: SEED.clinicId,
      scheduledStart: slot,
    })
    .expect(201);
  return { appointmentId: (res.body as { id: string }).id, slot };
}
