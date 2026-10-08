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

export interface ChannelAdapter {
  readonly channel: 'sms' | 'whatsapp' | 'push' | 'in_app' | 'email';
  send(
    recipient: NotificationRecipient,
    templateKey: string,
    payload: Record<string, string>,
    locale: 'en' | 'ur',
  ): Promise<DeliveryResult>;
}
