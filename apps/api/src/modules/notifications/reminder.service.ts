import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, gte, lt, notExists } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { appointments, notificationLog } from '../../common/database/schema';
import { inBatches } from '../../common/util/in-batches';
import { DAY_MS, startOfClinicDay } from '../booking/availability';
import { AppointmentReminderEvent, EVENT_APPOINTMENT_REMINDER } from './events';

/**
 * Reminders are the one thing in this module that isn't event-driven — a
 * scheduled job queries upcoming appointments and emits the same
 * AppointmentReminderEvent the rest of the pipeline already handles (see
 * the Phase 1 plan's NotificationsModule notes).
 *
 * Runs once a day, in the evening (CronController), and covers the whole of
 * tomorrow in clinic time. Vercel's Hobby plan allows nothing more frequent, so
 * the '2h' reminder is not sent: it needs a run every few minutes, as does a
 * '24h' reminder timed from the appointment instead of by calendar day. The
 * notification_log check is what stops an appointment being reminded twice.
 */
const BATCH_SIZE = 10;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Resolves once every reminder has been attempted, with how many there were. */
  async sendReminders(): Promise<number> {
    const tomorrow = startOfClinicDay(new Date(Date.now() + DAY_MS));
    return this.remindWindow(
      '24h',
      tomorrow,
      new Date(tomorrow.getTime() + DAY_MS),
    );
  }

  private async remindWindow(
    window: '24h' | '2h',
    from: Date,
    to: Date,
  ): Promise<number> {
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

    // Awaited: Vercel can freeze the function once the response is sent.
    await inBatches(due, BATCH_SIZE, (appointment) =>
      this.eventEmitter.emitAsync(
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
      ),
    );

    if (due.length > 0) {
      this.logger.log(`Fired ${due.length} ${window} reminder(s)`);
    }
    return due.length;
  }
}
