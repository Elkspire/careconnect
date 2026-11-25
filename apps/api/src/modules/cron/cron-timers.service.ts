import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NoShowService } from '../booking/no-show.service';
import { ReminderService } from '../notifications/reminder.service';

/**
 * In-process stand-in for Vercel Cron, loaded only off Vercel (CronModule).
 * Same schedules as apps/api/vercel.json, which Vercel reads as UTC.
 * ScheduleModule logs anything these throw.
 */
@Injectable()
export class CronTimersService {
  constructor(
    private readonly reminderService: ReminderService,
    private readonly noShowService: NoShowService,
  ) {}

  @Cron('0 13 * * *', { name: '/internal/cron/reminders', timeZone: 'UTC' })
  async reminders(): Promise<void> {
    await this.reminderService.sendReminders();
  }

  @Cron('0 16 * * *', { name: '/internal/cron/no-shows', timeZone: 'UTC' })
  async noShows(): Promise<void> {
    await this.noShowService.markNoShows();
  }
}
