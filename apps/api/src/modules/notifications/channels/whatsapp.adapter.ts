import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { renderTemplate, type TemplateKey } from '../templates';
import type {
  ChannelAdapter,
  DeliveryResult,
  NotificationRecipient,
} from './channel-adapter.interface';

/**
 * Sends via the WhatsApp Business Cloud API (Meta Graph API) directly. This
 * is treated as a primary channel per the product doc, not a fallback —
 * dispatched alongside SMS/in-app, never as a retry path.
 */
@Injectable()
export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel = 'whatsapp' as const;
  private readonly logger = new Logger(WhatsAppAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(
    recipient: NotificationRecipient,
    templateKey: string,
    payload: Record<string, string>,
    locale: 'en' | 'ur',
  ): Promise<DeliveryResult> {
    if (!recipient.phone) {
      return { status: 'failed', error: 'no_phone' };
    }

    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      this.logger.warn('WhatsApp not sent — not configured (see .env.example)');
      return { status: 'failed', error: 'not_configured' };
    }

    const body = renderTemplate(templateKey as TemplateKey, locale, payload);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipient.phone.replace(/^\+/, ''),
            type: 'text',
            text: { body },
          }),
        },
      );
      if (!res.ok) {
        return { status: 'failed', error: `whatsapp_http_${res.status}` };
      }
      const data = (await res.json()) as { messages?: Array<{ id: string }> };
      return { status: 'sent', providerMessageId: data.messages?.[0]?.id };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown_error',
      };
    }
  }
}
