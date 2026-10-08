import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  authUsers,
  clinics,
  patients,
  practitioners,
} from '../../common/database/schema';
import {
  AppointmentBookedEvent,
  AppointmentCancelledEvent,
  AppointmentNoShowEvent,
  AppointmentReminderEvent,
  AppointmentRescheduledEvent,
  EVENT_APPOINTMENT_BOOKED,
  EVENT_APPOINTMENT_CANCELLED,
  EVENT_APPOINTMENT_NO_SHOW,
  EVENT_APPOINTMENT_REMINDER,
  EVENT_APPOINTMENT_RESCHEDULED,
  EVENT_PATIENT_CHECKED_IN,
  EVENT_WAITLIST_OFFERED,
  EVENT_STAFF_INVITED,
  PatientCheckedInEvent,
  StaffInvitedEvent,
  WaitlistOfferedEvent,
} from './events';
import { NotificationDispatcher } from './notification-dispatcher.service';

function formatWhen(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface AppointmentContext {
  patientId: string;
  patientPhone: string | undefined;
  patientLocale: 'en' | 'ur';
  practitionerName: string;
  practitionerUserId: string;
  practitionerPhone: string | undefined;
  practitionerLocale: 'en' | 'ur';
  clinicName: string;
}

@Injectable()
export class NotificationListenerService {
  private readonly logger = new Logger(NotificationListenerService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  @OnEvent(EVENT_APPOINTMENT_BOOKED)
  async onBooked(event: AppointmentBookedEvent): Promise<void> {
    const ctx = await this.loadContext(event.appointment);
    if (!ctx) return;
    await this.dispatcher.dispatch({
      eventType: EVENT_APPOINTMENT_BOOKED,
      templateKey: 'appointment_booked',
      recipient: { userId: ctx.patientId, phone: ctx.patientPhone },
      payload: {
        practitionerName: ctx.practitionerName,
        clinicName: ctx.clinicName,
        when: formatWhen(event.appointment.scheduledStart),
      },
      locale: ctx.patientLocale,
      relatedAppointmentId: event.appointment.appointmentId,
    });
  }

  @OnEvent(EVENT_APPOINTMENT_RESCHEDULED)
  async onRescheduled(event: AppointmentRescheduledEvent): Promise<void> {
    const ctx = await this.loadContext(event.appointment);
    if (!ctx) return;
    await this.dispatcher.dispatch({
      eventType: EVENT_APPOINTMENT_RESCHEDULED,
      templateKey: 'appointment_rescheduled',
      recipient: { userId: ctx.patientId, phone: ctx.patientPhone },
      payload: {
        practitionerName: ctx.practitionerName,
        when: formatWhen(event.appointment.scheduledStart),
      },
      locale: ctx.patientLocale,
      relatedAppointmentId: event.appointment.appointmentId,
    });
  }

  @OnEvent(EVENT_APPOINTMENT_CANCELLED)
  async onCancelled(event: AppointmentCancelledEvent): Promise<void> {
    const ctx = await this.loadContext(event.appointment);
    if (!ctx) return;
    await this.dispatcher.dispatch({
      eventType: EVENT_APPOINTMENT_CANCELLED,
      templateKey: event.cancelledByStaff
        ? 'appointment_cancelled_by_clinic'
        : 'appointment_cancelled_by_patient',
      recipient: { userId: ctx.patientId, phone: ctx.patientPhone },
      payload: {
        practitionerName: ctx.practitionerName,
        clinicName: ctx.clinicName,
        when: formatWhen(event.appointment.scheduledStart),
      },
      locale: ctx.patientLocale,
      relatedAppointmentId: event.appointment.appointmentId,
    });
  }

  @OnEvent(EVENT_APPOINTMENT_REMINDER)
  async onReminder(event: AppointmentReminderEvent): Promise<void> {
    const ctx = await this.loadContext(event.appointment);
    if (!ctx) return;
    await this.dispatcher.dispatch({
      eventType: `${EVENT_APPOINTMENT_REMINDER}.${event.window}`,
      templateKey:
        event.window === '24h'
          ? 'appointment_reminder_24h'
          : 'appointment_reminder_2h',
      recipient: { userId: ctx.patientId, phone: ctx.patientPhone },
      payload: {
        practitionerName: ctx.practitionerName,
        when: formatWhen(event.appointment.scheduledStart),
      },
      locale: ctx.patientLocale,
      relatedAppointmentId: event.appointment.appointmentId,
    });
  }

  @OnEvent(EVENT_APPOINTMENT_NO_SHOW)
  async onNoShow(event: AppointmentNoShowEvent): Promise<void> {
    const ctx = await this.loadContext(event.appointment);
    if (!ctx) return;
    await this.dispatcher.dispatch({
      eventType: EVENT_APPOINTMENT_NO_SHOW,
      templateKey: 'appointment_no_show',
      recipient: { userId: ctx.patientId, phone: ctx.patientPhone },
      payload: {
        practitionerName: ctx.practitionerName,
        clinicName: ctx.clinicName,
        when: formatWhen(event.appointment.scheduledStart),
      },
      locale: ctx.patientLocale,
      relatedAppointmentId: event.appointment.appointmentId,
    });
  }

  /** Notifies the clinic (practitioner-owner), not the patient — "patient checked in and waiting" is a to-the-clinic notification per the product doc. */
  @OnEvent(EVENT_PATIENT_CHECKED_IN)
  async onCheckedIn(event: PatientCheckedInEvent): Promise<void> {
    const ctx = await this.loadContext(event.appointment);
    if (!ctx) return;
    const [patient] = await this.db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, event.appointment.patientId))
      .limit(1);
    if (!patient) return;

    await this.dispatcher.dispatch({
      eventType: EVENT_PATIENT_CHECKED_IN,
      templateKey: 'patient_checked_in',
      recipient: {
        userId: ctx.practitionerUserId,
        phone: ctx.practitionerPhone,
      },
      payload: { patientName: patient.fullName },
      locale: ctx.practitionerLocale,
      relatedAppointmentId: event.appointment.appointmentId,
    });
  }

  @OnEvent(EVENT_WAITLIST_OFFERED)
  async onWaitlistOffered(event: WaitlistOfferedEvent): Promise<void> {
    const ctx = await this.loadContext({
      patientId: event.patientId,
      practitionerId: event.practitionerId,
      clinicId: event.clinicId,
    });
    if (!ctx) return;

    await this.dispatcher.dispatch({
      eventType: EVENT_WAITLIST_OFFERED,
      templateKey: 'waitlist_slot_available',
      recipient: { userId: ctx.patientId, phone: ctx.patientPhone },
      payload: {
        practitionerName: ctx.practitionerName,
        clinicName: ctx.clinicName,
        requestedDate: event.requestedDate,
      },
      locale: ctx.patientLocale,
    });
  }

  /** Tells the invitee which clinic added them and as what — without this they had no way to learn they'd been invited at all. */
  @OnEvent(EVENT_STAFF_INVITED)
  async onStaffInvited(event: StaffInvitedEvent): Promise<void> {
    const [clinic] = await this.db
      .select({ name: clinics.name })
      .from(clinics)
      .where(eq(clinics.id, event.clinicId))
      .limit(1);
    const [inviter] = await this.db
      .select({ fullName: practitioners.fullName })
      .from(practitioners)
      .where(eq(practitioners.id, event.invitedBy))
      .limit(1);
    const [invitee] = await this.db
      .select({ phone: authUsers.phone, email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, event.userId))
      .limit(1);
    if (!clinic) return;

    await this.dispatcher.dispatch({
      eventType: EVENT_STAFF_INVITED,
      templateKey: 'staff_invited',
      recipient: {
        userId: event.userId,
        phone: invitee?.phone ?? undefined,
        email: invitee?.email ?? undefined,
      },
      payload: {
        inviterName: inviter?.fullName ?? clinic.name,
        clinicName: clinic.name,
        role: event.role,
      },
      locale: 'en',
    });
  }

  private async loadContext(appointment: {
    patientId: string;
    practitionerId: string;
    clinicId: string;
  }): Promise<AppointmentContext | null> {
    const [row] = await this.db
      .select({
        patientPhone: authUsers.phone,
        patientLocale: patients.preferredLanguage,
        practitionerName: practitioners.fullName,
        practitionerLanguages: practitioners.languages,
        clinicName: clinics.name,
      })
      .from(patients)
      .innerJoin(
        practitioners,
        eq(practitioners.id, appointment.practitionerId),
      )
      .innerJoin(clinics, eq(clinics.id, appointment.clinicId))
      .innerJoin(authUsers, eq(authUsers.id, patients.id))
      .where(eq(patients.id, appointment.patientId))
      .limit(1);

    if (!row) {
      this.logger.warn(
        `Could not load notification context for appointment (patient=${appointment.patientId})`,
      );
      return null;
    }

    const [practitionerUser] = await this.db
      .select({ phone: authUsers.phone })
      .from(authUsers)
      .where(eq(authUsers.id, appointment.practitionerId))
      .limit(1);

    return {
      patientId: appointment.patientId,
      patientPhone: row.patientPhone ?? undefined,
      patientLocale: row.patientLocale ?? 'en',
      practitionerName: row.practitionerName,
      practitionerUserId: appointment.practitionerId,
      practitionerPhone: practitionerUser?.phone ?? undefined,
      practitionerLocale: (row.practitionerLanguages[0] as 'en' | 'ur') ?? 'en',
      clinicName: row.clinicName,
    };
  }
}
