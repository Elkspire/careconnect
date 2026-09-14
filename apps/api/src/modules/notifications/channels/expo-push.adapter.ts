import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../../common/database/database.module';
import { expoPushTokens } from '../../../common/database/schema';
import { renderTemplate, type TemplateKey } from '../templates';
import type {
  ChannelAdapter,
  DeliveryResult,
  NotificationRecipient,
} from './channel-adapter.interface';

// See whatsapp.adapter.ts's FetchResponse comment — same ambient `Response`
// type inconsistency across this monorepo's split @types/node majors.
interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends via Expo's push service (routes to APNs/FCM on Expo's behalf) —
 * the mobile app's equivalent of PushAdapter's Web Push/VAPID flow. No API
 * key needed for Expo's default (unauthenticated) push sending. Requires an
 * EAS project id configured in the mobile app before any real token is ever
 * registered — see apps/mobile/src/lib/push-notifications.ts.
 */
@Injectable()
export class ExpoPushAdapter implements ChannelAdapter {
  readonly channel = 'push' as const;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async send(
    recipient: NotificationRecipient,
    templateKey: string,
    payload: Record<string, string>,
    locale: 'en' | 'ur',
  ): Promise<DeliveryResult> {
    const tokens = await this.db
      .select()
      .from(expoPushTokens)
      .where(eq(expoPushTokens.userId, recipient.userId));
    if (tokens.length === 0) {
      return { status: 'failed', error: 'no_subscription' };
    }

    const body = renderTemplate(templateKey as TemplateKey, locale, payload);
    const messages = tokens.map((t) => ({
      to: t.token,
      title: 'CareConnect',
      body,
    }));

    try {
      const res = (await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })) as unknown as FetchResponse;
      if (!res.ok) {
        return { status: 'failed', error: `expo_http_${res.status}` };
      }
      const { data } = (await res.json()) as { data: ExpoPushTicket[] };

      // Expo reports a token as permanently dead (uninstalled app, etc.) via
      // this error code — stop sending to it, same as the 404/410 handling
      // in push.adapter.ts.
      const staleTokens = tokens
        .filter((_, i) => data[i]?.details?.error === 'DeviceNotRegistered')
        .map((t) => t.token);
      for (const token of staleTokens) {
        await this.db.delete(expoPushTokens).where(eq(expoPushTokens.token, token));
      }

      const anySent = data.some((ticket) => ticket.status === 'ok');
      return anySent
        ? { status: 'sent' }
        : { status: 'failed', error: 'delivery_failed' };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown_error',
      };
    }
  }
}
