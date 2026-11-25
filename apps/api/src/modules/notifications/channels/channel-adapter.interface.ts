import type { NotificationLocale } from '../templates';
export interface NotificationRecipient {
  userId: string;
  phone?: string;
  email?: string;
}

export interface DeliveryResult {
  status: 'sent' | 'failed';
  providerMessageId?: string;
  error?: string;
}

/**
 * Requests wait for their notifications, so a provider that hangs must not
 * hang the booking with it.
 */
export const SEND_TIMEOUT_MS = 10_000;

export interface ChannelAdapter {
  readonly channel: 'sms' | 'whatsapp' | 'push' | 'in_app' | 'email';
  send(
    recipient: NotificationRecipient,
    templateKey: string,
    payload: Record<string, string>,
    locale: NotificationLocale,
  ): Promise<DeliveryResult>;
}
