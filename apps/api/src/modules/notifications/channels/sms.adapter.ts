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

// See whatsapp.adapter.ts's FetchResponse comment — same ambient `Response`
// type inconsistency across this monorepo's split @types/node majors.
interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** Sends via Twilio's REST API directly (no SDK) — see .env.example for required config. */
@Injectable()
export class SmsAdapter implements ChannelAdapter {
  readonly channel = 'sms' as const;
  private readonly logger = new Logger(SmsAdapter.name);

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

    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_SMS_FROM');
    if (!accountSid || !authToken || !from) {
      this.logger.warn(
        'SMS not sent — Twilio not configured (see .env.example)',
      );
      return { status: 'failed', error: 'not_configured' };
    }

    const body = renderTemplate(templateKey as TemplateKey, locale, payload);
    try {
      const res = (await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: recipient.phone,
            From: from,
            Body: body,
          }),
        },
      )) as unknown as FetchResponse;
      if (!res.ok) {
        return { status: 'failed', error: `twilio_http_${res.status}` };
      }
      const data = (await res.json()) as { sid?: string };
      return { status: 'sent', providerMessageId: data.sid };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown_error',
      };
    }
  }
}
