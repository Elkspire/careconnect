import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

// The monorepo's two apps pin different @types/node majors (apps/web ^20,
// apps/api ^24); some build environments resolve the ambient global
// `Response` type inconsistently across that split, dropping the fetch API
// members entirely. Naming the exact shape used here sidesteps relying on
// whichever `Response` declaration wins.
interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

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
    locale: NotificationLocale,
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
      const res = (await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
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
      )) as unknown as FetchResponse;
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
