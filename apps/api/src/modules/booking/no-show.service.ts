import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, lt } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { appointments } from '../../common/database/schema';
import {
  AppointmentNoShowEvent,
  EVENT_APPOINTMENT_NO_SHOW,
} from '../notifications/events';

/**
 * A patient who never checks in by the end of their own slot
 * (scheduled_end — practitioner_clinic.slot_length_minutes after
 * scheduled_start, e.g. 20 minutes) automatically becomes a no-show, so the
 * clinic doesn't have to manually close out every missed appointment.
 * "checked_in" appointments are untouched (that status only applies before
 * scheduled_end anyway — see clinic.service.ts's check-in flow).
 *
 * Runs every 5 minutes rather than exactly at each appointment's
 * scheduled_end — the WHERE clause below only ever matches appointments
 * still sitting at "booked" past their own scheduled_end, so a missed or
 * delayed run just catches up on the next tick instead of double-processing
 * anything.
 */
@Injectable()
export class NoShowService {
  private readonly logger = new Logger(NoShowService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/5 * * * *')
  async markNoShows(): Promise<void> {
    const overdue = await this.db
      .update(appointments)
      .set({ status: 'no_show' })
      .where(
        and(
          eq(appointments.status, 'booked'),
          lt(appointments.scheduledEnd, new Date()),
        ),
      )
      .returning({
        id: appointments.id,
        patientId: appointments.patientId,
        practitionerId: appointments.practitionerId,
        clinicId: appointments.clinicId,
        scheduledStart: appointments.scheduledStart,
      });

    for (const appointment of overdue) {
      this.eventEmitter.emit(
        EVENT_APPOINTMENT_NO_SHOW,
        new AppointmentNoShowEvent({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          practitionerId: appointment.practitionerId,
          clinicId: appointment.clinicId,
          scheduledStart: appointment.scheduledStart,
        }),
      );
    }

    if (overdue.length > 0) {
      this.logger.log(`Marked ${overdue.length} appointment(s) as no-show`);
    }
  }
}
