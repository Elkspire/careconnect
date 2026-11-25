import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Global, type INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../common/database/database.module';
import { NoShowService } from '../booking/no-show.service';
import { ReminderService } from '../notifications/reminder.service';
import { CronController } from './cron.controller';
import { CronModule } from './cron.module';

@Global()
@Module({
  providers: [{ provide: DRIZZLE, useValue: {} }],
  exports: [DRIZZLE],
})
class FakeDatabaseModule {}

describe('CronModule', () => {
  const sendReminders = jest.fn(() => Promise.resolve(0));
  const markNoShows = jest.fn(() => Promise.resolve(0));
  const vercel = process.env.VERCEL;
  let app: INestApplication | undefined;

  async function start(env: string | undefined) {
    if (env === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = env;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        EventEmitterModule.forRoot(),
        FakeDatabaseModule,
        CronModule.register(),
      ],
    })
      .overrideProvider(ReminderService)
      .useValue({ sendReminders })
      .overrideProvider(NoShowService)
      .useValue({ markNoShows })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    return app;
  }

  beforeEach(() => jest.clearAllMocks());
  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.useRealTimers();
    if (vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = vercel;
  });

  it('loads no scheduler on Vercel, but keeps the cron routes', async () => {
    const nest = await start('1');
    expect(() => nest.get(SchedulerRegistry, { strict: false })).toThrow();
    expect(nest.get(CronController)).toBeDefined();
  });

  it('runs on the same schedules as vercel.json elsewhere', async () => {
    const nest = await start(undefined);
    const { crons } = JSON.parse(
      readFileSync(join(__dirname, '../../../vercel.json'), 'utf8'),
    ) as { crons: Array<{ path: string; schedule: string }> };
    const jobs = nest.get(SchedulerRegistry, { strict: false }).getCronJobs();
    expect(
      [...jobs].map(([path, job]) => ({
        path,
        schedule: job.cronTime.source,
        timeZone: job.cronTime.timeZone,
      })),
    ).toEqual(crons.map((cron) => ({ ...cron, timeZone: 'UTC' })));
    expect(nest.get(CronController)).toBeDefined();
  });

  it.each([
    ['off Vercel, each timer runs its own job', undefined, 1],
    ['on Vercel, no timer runs', '1', 0],
  ])('%s', async (_name, env, calls) => {
    jest.useFakeTimers({
      now: new Date('2026-11-25T12:59:00Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });
    await start(env);
    await jest.advanceTimersByTimeAsync(2 * 60_000);
    expect(sendReminders).toHaveBeenCalledTimes(calls);
    expect(markNoShows).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(sendReminders).toHaveBeenCalledTimes(calls);
    expect(markNoShows).toHaveBeenCalledTimes(calls);
  });
});
