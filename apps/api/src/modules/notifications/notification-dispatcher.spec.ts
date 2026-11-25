import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  EventEmitter2,
  EventEmitterModule,
  OnEvent,
} from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pg-proxy';
import type { Database } from '../../common/database/database.module';
import { SEND_TIMEOUT_MS } from './channels/channel-adapter.interface';
import type { EmailAdapter } from './channels/email.adapter';
import { ExpoPushAdapter } from './channels/expo-push.adapter';
import type { InAppAdapter } from './channels/in-app.adapter';
import type { PushAdapter } from './channels/push.adapter';
import { SmsAdapter } from './channels/sms.adapter';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';
import {
  type DispatchParams,
  NotificationDispatcher,
} from './notification-dispatcher.service';

const PARAMS: DispatchParams = {
  eventType: 'appointment.booked',
  templateKey: 'appointment_booked',
  recipient: { userId: 'user-1', phone: '+923001234567' },
  payload: { practitionerName: 'Dr A', clinicName: 'Clinic', when: 'today' },
  locale: 'en',
};

let logged: jest.SpyInstance;
beforeEach(() => {
  logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
});
afterEach(() => jest.restoreAllMocks());

describe('NotificationDispatcher', () => {
  it('waits for slow channels even when another one throws', async () => {
    const finished: string[] = [];
    const channel = (name: string, send: () => Promise<void>) => ({
      channel: name,
      send: async () => {
        await send();
        finished.push(name);
        return { status: 'sent' };
      },
    });
    const ok = () => Promise.resolve();
    const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 30));
    const logRows: unknown[][] = [];
    const db = drizzle((_sql, params) => {
      logRows.push(params);
      return Promise.resolve({ rows: [] });
    });
    const dispatcher = new NotificationDispatcher(
      db as unknown as Database,
      channel('sms', slow) as unknown as SmsAdapter,
      channel('whatsapp', () =>
        Promise.reject(new Error('it broke')),
      ) as unknown as WhatsAppAdapter,
      channel('push', slow) as unknown as PushAdapter,
      channel('push', ok) as unknown as ExpoPushAdapter,
      channel('in_app', ok) as unknown as InAppAdapter,
      channel('email', slow) as unknown as EmailAdapter,
    );

    await dispatcher.dispatch(PARAMS);

    expect(finished.sort()).toEqual(['email', 'in_app', 'push', 'push', 'sms']);
    expect(logRows).toHaveLength(5);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      'appointment.booked via whatsapp failed: it broke',
      expect.any(String),
    );
  });
});

describe('a provider that never answers', () => {
  const config = { get: () => 'configured' } as unknown as ConfigService;

  it.each([
    ['sms', () => new SmsAdapter(config)],
    ['whatsapp', () => new WhatsAppAdapter(config)],
    [
      'expo push',
      () =>
        new ExpoPushAdapter(
          drizzle(() =>
            Promise.resolve({ rows: [['id', 'user-1', 'token', null]] }),
          ) as unknown as Database,
        ),
    ],
  ])('%s is given up on', async (_name, make) => {
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => AbortSignal.abort(new Error('timed out')));
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) reject(init.signal.reason as Error);
        }),
    );
    await expect(
      make().send(PARAMS.recipient, PARAMS.templateKey, PARAMS.payload, 'en'),
    ).resolves.toEqual({ status: 'failed', error: 'timed out' });
    expect(timeout).toHaveBeenCalledWith(SEND_TIMEOUT_MS);
  });
});

/** What lets a request await its notifications without depending on them. */
describe('emitAsync with @OnEvent listeners', () => {
  it('waits for every listener and survives one failing', async () => {
    const finished: string[] = [];
    class Listener {
      @OnEvent('some.event')
      fails() {
        return Promise.reject(new Error('it broke'));
      }
      @OnEvent('some.event')
      async slow() {
        await new Promise((resolve) => setTimeout(resolve, 30));
        finished.push('slow');
      }
    }
    const module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [Listener],
    }).compile();
    await module.init();
    await module.get(EventEmitter2).emitAsync('some.event');
    expect(finished).toEqual(['slow']);
    await module.close();
  });
});
