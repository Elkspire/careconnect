import { Module } from '@nestjs/common';
import { EmailAdapter } from './channels/email.adapter';
import { ExpoPushAdapter } from './channels/expo-push.adapter';
import { InAppAdapter } from './channels/in-app.adapter';
import { PushAdapter } from './channels/push.adapter';
import { SmsAdapter } from './channels/sms.adapter';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationListenerService } from './notification-listener.service';
import { NotificationsController } from './notifications.controller';
import { ReminderService } from './reminder.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    SmsAdapter,
    WhatsAppAdapter,
    PushAdapter,
    ExpoPushAdapter,
    InAppAdapter,
    EmailAdapter,
    NotificationDispatcher,
    NotificationListenerService,
    ReminderService,
  ],
  exports: [NotificationDispatcher],
})
export class NotificationsModule {}
