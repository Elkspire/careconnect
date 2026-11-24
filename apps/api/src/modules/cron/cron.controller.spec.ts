import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DRIZZLE } from '../../common/database/database.module';
import { ClinicRoleGuard } from '../../common/guards/clinic-role.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { NoShowService } from '../booking/no-show.service';
import { ReminderService } from '../notifications/reminder.service';
import { CronController } from './cron.controller';

const SECRET = 'a-cron-secret-for-tests';
const ROUTES = ['/internal/cron/reminders', '/internal/cron/no-shows'];

describe('CronController', () => {
  const sendReminders = jest.fn(() => Promise.resolve(3));
  const markNoShows = jest.fn(() => Promise.resolve(2));
  let secret: string | undefined;
  let app: INestApplication<App>;

  // Over real HTTP, behind the same global guards as AppModule.
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ReminderService, useValue: { sendReminders } },
        { provide: NoShowService, useValue: { markNoShows } },
        { provide: ConfigService, useValue: { get: () => secret } },
        { provide: DRIZZLE, useValue: {} },
        { provide: APP_GUARD, useClass: SupabaseAuthGuard },
        { provide: APP_GUARD, useClass: ClinicRoleGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    secret = SECRET;
    jest.clearAllMocks();
  });

  const call = (path: string, authorization?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return authorization === undefined
      ? req
      : req.set('Authorization', authorization);
  };

  const expectNothingRan = () => {
    expect(sendReminders).not.toHaveBeenCalled();
    expect(markNoShows).not.toHaveBeenCalled();
  };

  describe.each(ROUTES)('%s', (path) => {
    it.each([
      ['no header', undefined],
      ['an empty header', ''],
      ['the wrong secret', 'Bearer wrong'],
      ['the secret without Bearer', SECRET],
      ['only the start of the secret', `Bearer ${SECRET.slice(0, -1)}`],
      ['the secret plus more', `Bearer ${SECRET}x`],
    ])('refuses %s', async (_name, authorization) => {
      await call(path, authorization).expect(401);
      expectNothingRan();
    });

    it.each([undefined, ''])(
      'refuses everything while CRON_SECRET is %p',
      async (unset) => {
        secret = unset;
        for (const header of [
          undefined,
          'Bearer ',
          'Bearer undefined',
          `Bearer ${SECRET}`,
        ]) {
          await call(path, header).expect(401);
        }
        expectNothingRan();
      },
    );

    it('only answers GET', async () => {
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${SECRET}`)
        .expect(404);
      expectNothingRan();
    });
  });

  it('runs only the reminders', async () => {
    await call(ROUTES[0]!, `Bearer ${SECRET}`)
      .expect(200)
      .expect({ reminders: 3 });
    expect(sendReminders).toHaveBeenCalledTimes(1);
    expect(markNoShows).not.toHaveBeenCalled();
  });

  it('runs only the no-shows', async () => {
    await call(ROUTES[1]!, `Bearer ${SECRET}`)
      .expect(200)
      .expect({ noShows: 2 });
    expect(markNoShows).toHaveBeenCalledTimes(1);
    expect(sendReminders).not.toHaveBeenCalled();
  });

  it('reports a failed run as an error', async () => {
    sendReminders.mockRejectedValueOnce(new Error('database is down'));
    await call(ROUTES[0]!, `Bearer ${SECRET}`).expect(500);
  });
});
