import { Injectable } from '@nestjs/common';
import type {
  ChannelAdapter,
  DeliveryResult,
} from './channel-adapter.interface';

/**
 * Always succeeds — the actual persistence (and thus the in-app feed data)
 * is the notification_log row NotificationDispatcher writes for every
 * channel attempt. This adapter exists only so in_app is dispatched through
 * the same uniform pipeline as the other channels, not a special case.
 */
@Injectable()
export class InAppAdapter implements ChannelAdapter {
  readonly channel = 'in_app' as const;

  send(): Promise<DeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }
}
