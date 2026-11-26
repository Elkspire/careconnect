import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import {
  DRIZZLE,
  type Database,
} from '../../../common/database/database.module';
import { pushSubscriptions } from '../../../common/database/schema';
import {
  renderTemplate,
  type TemplateKey,
  type NotificationLocale,
} from '../templates';
import {
  type ChannelAdapter,
  type DeliveryResult,
  type NotificationRecipient,
  SEND_TIMEOUT_MS,
} from './channel-adapter.interface';

/**
 * Real browser push via the Web Push protocol (VAPID) — see
 * 0005_push_subscriptions.sql for the subscription table and
 * NotificationsController for the subscribe/unsubscribe endpoints the
 * frontend's service worker flow calls.
 */
@Injectable()
export class PushAdapter implements ChannelAdapter {
  readonly channel = 'push' as const;
  private readonly logger = new Logger(PushAdapter.name);
  private vapidConfigured = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  private ensureVapid(): boolean {
    if (this.vapidConfigured) {
      return true;
    }
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'Push not sent — VAPID keys not configured (see .env.example)',
      );
      return false;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidConfigured = true;
    return true;
  }

  async send(
    recipient: NotificationRecipient,
    templateKey: string,
    payload: Record<string, string>,
    locale: NotificationLocale,
  ): Promise<DeliveryResult> {
    if (!this.ensureVapid()) {
      return { status: 'failed', error: 'not_configured' };
    }

    const subscriptions = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, recipient.userId));
    if (subscriptions.length === 0) {
      return { status: 'failed', error: 'no_subscription' };
    }

    const body = renderTemplate(templateKey as TemplateKey, locale, payload);
    const message = JSON.stringify({ title: 'CareConnect', body });

    // allSettled: failing to delete one dead endpoint must not stop the wait
    // for the others. It is tried again on the next send.
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
            { timeout: SEND_TIMEOUT_MS },
          );
          return true;
        } catch (err) {
          // 404/410 mean the push service has permanently invalidated this
          // endpoint (browser data cleared, permission revoked, etc.) —
          // stop sending to it. Any other error just fails this attempt.
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, sub.endpoint));
          }
          return false;
        }
      }),
    );

    return results.some((r) => r.status === 'fulfilled' && r.value)
      ? { status: 'sent' }
      : { status: 'failed', error: 'delivery_failed' };
  }
}
