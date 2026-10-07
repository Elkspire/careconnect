/**
 * Domain events the booking/clinic modules emit via EventEmitter2.
 * NotificationsModule listens for these and fans them out through the
 * dispatcher — see notification-listener.service.ts.
 */

export const EVENT_APPOINTMENT_BOOKED = 'appointment.booked';
export const EVENT_APPOINTMENT_RESCHEDULED = 'appointment.rescheduled';
export const EVENT_APPOINTMENT_CANCELLED = 'appointment.cancelled';
export const EVENT_PATIENT_CHECKED_IN = 'patient.checked_in';
export const EVENT_WAITLIST_OFFERED = 'waitlist.offered';
export const EVENT_APPOINTMENT_REMINDER = 'appointment.reminder';
export const EVENT_APPOINTMENT_NO_SHOW = 'appointment.no_show';

interface AppointmentEventBase {
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  clinicId: string;
  scheduledStart: Date;
}

export class AppointmentBookedEvent {
  constructor(public readonly appointment: AppointmentEventBase) {}
}

export class AppointmentRescheduledEvent {
  constructor(
    public readonly appointment: AppointmentEventBase,
    public readonly previousStart: Date,
  ) {}
}

export class AppointmentCancelledEvent {
  constructor(
    public readonly appointment: AppointmentEventBase,
    public readonly cancelledByStaff: boolean,
  ) {}
}

export class PatientCheckedInEvent {
  constructor(public readonly appointment: AppointmentEventBase) {}
}

export class WaitlistOfferedEvent {
  constructor(
    public readonly waitlistEntryId: string,
    public readonly patientId: string,
    public readonly practitionerId: string,
    public readonly clinicId: string,
    public readonly requestedDate: string,
  ) {}
}

/** window: which reminder this is — drives template choice, not timing (ReminderService already selected the right appointments). */
export class AppointmentReminderEvent {
  constructor(
    public readonly appointment: AppointmentEventBase,
    public readonly window: '24h' | '2h',
  ) {}
}

export class AppointmentNoShowEvent {
  constructor(public readonly appointment: AppointmentEventBase) {}
}

export const EVENT_STAFF_INVITED = 'staff.invited';

/** Fired after a clinic owner adds someone to their clinic's staff — tells the invitee, who otherwise has no way to find out. */
export class StaffInvitedEvent {
  constructor(
    public readonly clinicId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly invitedBy: string,
  ) {}
}
