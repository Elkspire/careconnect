import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronController } from './cron.controller';

@Module({
  imports: [BookingModule, NotificationsModule],
  controllers: [CronController],
})
export class CronModule {}
