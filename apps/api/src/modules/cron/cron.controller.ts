import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';
import { NoShowService } from '../booking/no-show.service';
import { ReminderService } from '../notifications/reminder.service';

/**
 * Called by Vercel Cron on the schedules in apps/api/vercel.json. GET because
 * that is the only method Vercel sends. @Public() only skips the user-session
 * check; CronSecretGuard is what protects these.
 */
@Public()
@UseGuards(CronSecretGuard)
@Controller('internal/cron')
export class CronController {
  constructor(
    private readonly reminderService: ReminderService,
    private readonly noShowService: NoShowService,
  ) {}

  @Get('reminders')
  async reminders(): Promise<{ reminders: number }> {
    return { reminders: await this.reminderService.sendReminders() };
  }

  @Get('no-shows')
  async noShows(): Promise<{ noShows: number }> {
    return { noShows: await this.noShowService.markNoShows() };
  }
}
