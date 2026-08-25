import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, gte, lt, notExists } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { appointments, notificationLog } from '../../common/database/schema';
import { AppointmentReminderEvent, EVENT_APPOINTMENT_REMINDER } from './events';

/**
 * Reminders are the one thing in this module that isn't event-driven — a
 * scheduled job queries upcoming appointments and emits the same
 * AppointmentReminderEvent the rest of the pipeline already handles (see
 * the Phase 1 plan's NotificationsModule notes).
 *
 * Runs every 15 minutes, matching the window width below, so each
 * appointment falls into exactly one run's [from, to) bucket for a given
 * reminder — the notification_log dedup check is what actually prevents
 * double-sends if a run is missed/retried, this just keeps buckets tight.
 */
const WINDOW_MINUTES = 15;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(`*/${WINDOW_MINUTES} * * * *`)
  async sendReminders(): Promise<void> {
    await this.remindWindow('24h', 24 * 60);
    await this.remindWindow('2h', 2 * 60);
  }

  private async remindWindow(
    window: '24h' | '2h',
    minutesAhead: number,
  ): Promise<void> {
    const now = new Date();
    const from = new Date(
      now.getTime() + (minutesAhead - WINDOW_MINUTES) * 60_000,
    );
    const to = new Date(now.getTime() + minutesAhead * 60_000);
    const eventType = `${EVENT_APPOINTMENT_REMINDER}.${window}`;

    const due = await this.db
      .select({
        appointmentId: appointments.id,
        patientId: appointments.patientId,
        practitionerId: appointments.practitionerId,
        clinicId: appointments.clinicId,
        scheduledStart: appointments.scheduledStart,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'booked'),
          gte(appointments.scheduledStart, from),
          lt(appointments.scheduledStart, to),
          notExists(
            this.db
              .select({ id: notificationLog.id })
              .from(notificationLog)
              .where(
                and(
                  eq(notificationLog.relatedAppointmentId, appointments.id),
                  eq(notificationLog.eventType, eventType),
                ),
              ),
          ),
        ),
      );

    for (const appointment of due) {
      this.eventEmitter.emit(
        EVENT_APPOINTMENT_REMINDER,
        new AppointmentReminderEvent(
          {
            appointmentId: appointment.appointmentId,
            patientId: appointment.patientId,
            practitionerId: appointment.practitionerId,
            clinicId: appointment.clinicId,
            scheduledStart: appointment.scheduledStart,
          },
          window,
        ),
      );
    }

    if (due.length > 0) {
      this.logger.log(`Fired ${due.length} ${window} reminder(s)`);
    }
  }
}
