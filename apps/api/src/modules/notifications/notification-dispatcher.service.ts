import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { notificationLog } from '../../common/database/schema';
import { EmailAdapter } from './channels/email.adapter';
import { ExpoPushAdapter } from './channels/expo-push.adapter';
import { InAppAdapter } from './channels/in-app.adapter';
import type {
  ChannelAdapter,
  NotificationRecipient,
} from './channels/channel-adapter.interface';
import { PushAdapter } from './channels/push.adapter';
import { SmsAdapter } from './channels/sms.adapter';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';
import {
  renderTemplate,
  type TemplateKey,
  type NotificationLocale,
} from './templates';

export interface DispatchParams {
  eventType: string;
  templateKey: TemplateKey;
  recipient: NotificationRecipient;
  payload: Record<string, string>;
  locale: NotificationLocale;
  relatedAppointmentId?: string;
}

/**
 * Fans out to every channel — WhatsApp/SMS/in-app are all primary channels
 * per the product doc, not a try-then-fallback chain, so every enabled
 * adapter is dispatched in parallel regardless of the others' outcomes.
 * Every attempt writes a notification_log row (see 0001_init.sql), giving
 * one place to debug delivery failures per channel.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly smsAdapter: SmsAdapter,
    private readonly whatsAppAdapter: WhatsAppAdapter,
    private readonly pushAdapter: PushAdapter,
    private readonly expoPushAdapter: ExpoPushAdapter,
    private readonly inAppAdapter: InAppAdapter,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  private get adapters(): ChannelAdapter[] {
    return [
      this.smsAdapter,
      this.whatsAppAdapter,
      this.pushAdapter,
      this.expoPushAdapter,
      this.inAppAdapter,
      this.emailAdapter,
    ];
  }

  /** Resolves once every channel has finished, whether or not it worked. */
  async dispatch(params: DispatchParams): Promise<void> {
    const message = renderTemplate(
      params.templateKey,
      params.locale,
      params.payload,
    );

    // allSettled, not all: the first channel to throw would end the wait
    // while the others are still sending.
    const adapters = this.adapters;
    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        const result = await adapter.send(
          params.recipient,
          params.templateKey,
          params.payload,
          params.locale,
        );
        await this.db.insert(notificationLog).values({
          eventType: params.eventType,
          channel: adapter.channel,
          recipientUserId: params.recipient.userId,
          relatedAppointmentId: params.relatedAppointmentId,
          status: result.status,
          providerMessageId: result.providerMessageId,
          message,
        });
      }),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const error = result.reason as Error;
        this.logger.error(
          `${params.eventType} via ${adapters[i]!.channel} failed: ${error.message}`,
          error.stack,
        );
      }
    });
  }
}
