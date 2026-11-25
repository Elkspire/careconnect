import { type DynamicModule, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingModule } from '../booking/booking.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronTimersService } from './cron-timers.service';
import { CronController } from './cron.controller';

@Module({
  imports: [BookingModule, NotificationsModule],
  controllers: [CronController],
})
export class CronModule {
  /**
   * On Vercel, Vercel Cron calls CronController. Anywhere else nothing would,
   * so in-process timers run the same jobs. Never both. Vercel sets VERCEL=1
   * at build and runtime (needs the project's "system environment variables"
   * setting, on for careconnect-api).
   */
  static register(): DynamicModule {
    if (process.env.VERCEL) {
      return { module: CronModule };
    }
    return {
      module: CronModule,
      imports: [ScheduleModule.forRoot()],
      providers: [CronTimersService],
    };
  }
}
