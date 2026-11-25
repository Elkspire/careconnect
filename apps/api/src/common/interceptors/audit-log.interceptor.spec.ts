import {
  type ExecutionContext,
  type HttpException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, type Observable, of, throwError } from 'rxjs';
import type {
  AuditEntry,
  AuditLogService,
} from '../../modules/audit/audit.service';
import { Audit } from '../decorators/audit.decorator';
import { AuditLogInterceptor } from './audit-log.interceptor';

class Routes {
  @Audit('view', 'clinical_note', 'owner')
  audited() {}
  @Audit('update', 'clinical_note', 'owner')
  change() {}
  @Audit('update', 'clinical_note', 'owner', ['warnings'])
  warned() {}
  @Audit('view', 'patient_record', 'patient')
  own() {}
  plain() {}
}

const NOTE = { id: 'note-1', patientId: 'patient-1' };

function run({
  route = 'audited',
  user = { id: 'user-1' },
  handled = of<unknown>(NOTE),
  record = () => Promise.resolve(),
  clinicRole,
  params = { clinicId: 'clinic-1', appointmentId: 'appointment-1' },
}: {
  route?: keyof Routes;
  user?: { id: string } | null;
  handled?: Observable<unknown>;
  record?: (entry: AuditEntry) => Promise<void>;
  clinicRole?: string;
  params?: Record<string, string>;
} = {}) {
  const spy = jest.fn(record);
  const interceptor = new AuditLogInterceptor(new Reflector(), {
    record: spy,
  } as unknown as AuditLogService);
  const context = {
    getHandler: (): unknown => Reflect.get(Routes.prototype, route),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        clinicRole,
        params,
      }),
    }),
  } as unknown as ExecutionContext;
  const response = lastValueFrom(
    interceptor.intercept(context, { handle: () => handled }),
  );
  return { record: spy, response };
}

describe('AuditLogInterceptor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records who reached what, and passes the result through', async () => {
    const { record, response } = run();
    await expect(response).resolves.toBe(NOTE);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      actorRole: 'owner',
      action: 'view',
      resourceType: 'clinical_note',
      resourceId: 'appointment-1',
      clinicId: 'clinic-1',
      patientId: 'patient-1',
      patientOf: { appointmentId: 'appointment-1' },
      metadata: undefined,
    });
  });

  it("records the role the caller is acting in, not the route's", async () => {
    const { record, response } = run({ clinicRole: 'junior_doctor' });
    await response;
    expect(record.mock.calls[0]![0].actorRole).toBe('junior_doctor');
  });

  it.each([
    [
      'the patient in the URL',
      { params: { patientId: 'patient-2', familyMemberId: 'kid-1' } },
      { patientId: 'patient-2', metadata: { familyMemberId: 'kid-1' } },
    ],
    [
      'whose appointment it is',
      { params: { appointmentId: 'a-1' } },
      { patientId: undefined, patientOf: { appointmentId: 'a-1' } },
    ],
    [
      'whose record it is',
      { params: { recordId: 'r-1' } },
      { resourceId: 'r-1', patientOf: { recordId: 'r-1' } },
    ],
    [
      'the patient, opening their own',
      { route: 'own' as const, params: { id: 'r-1' } },
      { resourceId: 'r-1', patientId: 'user-1' },
    ],
  ])('works out %s', async (_name, options, expected) => {
    const { record, response } = run({ ...options, handled: of(null) });
    await response;
    expect(record).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  it('holds the response until the entry is saved', async () => {
    let finish = () => {};
    const saving = new Promise<void>((resolve) => (finish = resolve));
    const { record, response } = run({ record: () => saving });
    let done = false;
    const request = response.then(() => (done = true));

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(record).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);

    finish();
    await request;
  });

  it.each([
    ['refuses a view', 'audited', 503, /refused/],
    ['fails a change, saying it was saved', 'change', 500, /was saved/],
  ] as const)('%s it cannot record', async (_name, route, status, message) => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { response } = run({
      route,
      record: () => Promise.reject(new Error('database is down')),
    });
    const error = await response.then(
      () => undefined,
      (err: unknown) => err as HttpException,
    );
    expect(error?.getStatus()).toBe(status);
    expect(error?.message).toMatch(message);
    expect(error?.message).not.toContain('database is down');
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]![0]).toMatch(/"user-1".*database is down/);
  });

  it('returns only the warnings of a change it cannot record', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { response } = run({
      route: 'warned',
      handled: of({ ...NOTE, warnings: ['Penicillin'] }),
      record: () => Promise.reject(new Error('database is down')),
    });
    const error = await response.then(
      () => undefined,
      (err: unknown) => err as HttpException,
    );
    expect(error?.getResponse()).toEqual({
      statusCode: 500,
      code: 'audit_change_saved',
      message: expect.any(String) as string,
      warnings: ['Penicillin'],
    });
  });

  it('passes an empty result through', async () => {
    const { record, response } = run({ handled: of(undefined) });
    await expect(response).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('records nothing when the handler fails', async () => {
    const { record, response } = run({
      handled: throwError(() => new Error('not allowed')),
    });
    await expect(response).rejects.toThrow('not allowed');
    expect(record).not.toHaveBeenCalled();
  });

  it.each([
    ['a route without @Audit', { route: 'plain' as const }],
    ['a request without a user', { user: null }],
  ])('records nothing for %s', async (_name, options) => {
    const { record, response } = run(options);
    await expect(response).resolves.toBe(NOTE);
    expect(record).not.toHaveBeenCalled();
  });
});
