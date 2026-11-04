import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import {
  renderTemplate,
  type TemplateKey,
  type NotificationLocale,
} from '../templates';
import type {
  ChannelAdapter,
  DeliveryResult,
  NotificationRecipient,
} from './channel-adapter.interface';

const SUBJECTS: Partial<
  Record<
    TemplateKey,
    Record<NotificationLocale, (p: Record<string, string>) => string>
  >
> = {
  staff_invited: {
    en: (p) => `You've been added to ${p.clinicName} on CareConnect`,
    ur: (p) => `آپ کو کیئر کنیکٹ پر ${p.clinicName} میں شامل کیا گیا ہے`,
    'ur-Latn': (p) =>
      `Aap ko CareConnect par ${p.clinicName} mein shaamil kiya gaya hai`,
  },
};

const SIGN_IN_LINE: Record<NotificationLocale, string> = {
  en: 'Sign in here:',
  ur: 'یہاں سائن ان کریں:',
  'ur-Latn': 'Yahan sign in karein:',
};

/**
 * Sends via plain SMTP (Gmail app password, Resend SMTP, etc. — see
 * .env.example). Only reaches recipients the caller gave an email for;
 * like SmsAdapter without a phone, it logs a failed attempt and moves on.
 */
@Injectable()
export class EmailAdapter implements ChannelAdapter {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(EmailAdapter.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(
    recipient: NotificationRecipient,
    templateKey: string,
    payload: Record<string, string>,
    locale: NotificationLocale,
  ): Promise<DeliveryResult> {
    if (!recipient.email) {
      return { status: 'failed', error: 'no_email' };
    }

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;
    if (!host || !user || !pass) {
      this.logger.warn(
        'Email not sent — SMTP not configured (see .env.example)',
      );
      return { status: 'failed', error: 'not_configured' };
    }

    if (!this.transporter) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
      this.transporter = createTransport({
        host,
        port,
        // 465 is implicit TLS; 587 upgrades via STARTTLS instead.
        secure: port === 465,
        auth: { user, pass },
      });
    }

    const key = templateKey as TemplateKey;
    const body = renderTemplate(key, locale, payload);
    const webOrigin = this.config.get<string>('WEB_ORIGIN');
    // Plain text with one bare link — no HTML, no tracking, nothing that
    // pushes the spam score up (see the iCloud junk-folder issue).
    const text = webOrigin
      ? `${body}\n\n${SIGN_IN_LINE[locale]} ${webOrigin}/${locale}/login`
      : body;

    try {
      const info = await this.transporter.sendMail({
        from,
        to: recipient.email,
        subject: SUBJECTS[key]?.[locale](payload) ?? 'CareConnect',
        text,
      });
      return { status: 'sent', providerMessageId: info.messageId };
    } catch (err) {
      this.logger.warn(
        `Email to ${recipient.email} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown_error',
      };
    }
  }
}
