/**
 * Plain functions, not a heavy i18n dependency — kept separate from
 * delivery/adapter logic so wording changes never touch channel code (see
 * the Phase 1 plan's NotificationsModule notes).
 */
export type TemplateKey =
  | 'appointment_booked'
  | 'appointment_rescheduled'
  | 'appointment_cancelled_by_patient'
  | 'appointment_cancelled_by_clinic'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'patient_checked_in'
  | 'appointment_no_show'
  | 'waitlist_slot_available'
  | 'staff_invited';

type TemplateFn = (payload: Record<string, string>) => string;

const STAFF_ROLE_LABELS: Record<'en' | 'ur', Record<string, string>> = {
  en: { receptionist: 'Receptionist', junior_doctor: 'Junior Doctor' },
  ur: { receptionist: 'ریسیپشنسٹ', junior_doctor: 'جونیئر ڈاکٹر' },
};

const templates: Record<TemplateKey, Record<'en' | 'ur', TemplateFn>> = {
  appointment_booked: {
    en: (p) =>
      `Your appointment with ${p.practitionerName} at ${p.clinicName} is confirmed for ${p.when}.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ ${p.clinicName} میں آپ کی اپائنٹمنٹ ${p.when} کے لیے کنفرم ہو گئی ہے۔`,
  },
  appointment_rescheduled: {
    en: (p) =>
      `Your appointment with ${p.practitionerName} has been moved to ${p.when}.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ آپ کی اپائنٹمنٹ ${p.when} پر منتقل کر دی گئی ہے۔`,
  },
  appointment_cancelled_by_patient: {
    en: (p) =>
      `Your appointment with ${p.practitionerName} on ${p.when} has been cancelled.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ ${p.when} کی آپ کی اپائنٹمنٹ منسوخ کر دی گئی ہے۔`,
  },
  appointment_cancelled_by_clinic: {
    en: (p) =>
      `${p.clinicName} has cancelled your appointment on ${p.when}. Please rebook at your convenience.`,
    ur: (p) =>
      `${p.clinicName} نے ${p.when} کی آپ کی اپائنٹمنٹ منسوخ کر دی ہے۔ براہ کرم دوبارہ بک کریں۔`,
  },
  appointment_reminder_24h: {
    en: (p) =>
      `Reminder: you have an appointment with ${p.practitionerName} tomorrow at ${p.when}.`,
    ur: (p) =>
      `یاد دہانی: کل ${p.when} پر ${p.practitionerName} کے ساتھ آپ کی اپائنٹمنٹ ہے۔`,
  },
  appointment_reminder_2h: {
    en: (p) =>
      `Reminder: your appointment with ${p.practitionerName} is at ${p.when}, coming up soon.`,
    ur: (p) =>
      `یاد دہانی: ${p.practitionerName} کے ساتھ آپ کی اپائنٹمنٹ ${p.when} پر ہے، جلد شروع ہونے والی ہے۔`,
  },
  patient_checked_in: {
    en: (p) => `${p.patientName} has checked in and is waiting.`,
    ur: (p) => `${p.patientName} چیک ان کر چکے ہیں اور انتظار میں ہیں۔`,
  },
  appointment_no_show: {
    en: (p) =>
      `You missed your ${p.when} appointment with ${p.practitionerName} at ${p.clinicName}. Please rebook if you still need it.`,
    ur: (p) =>
      `آپ ${p.practitionerName} کے ساتھ ${p.clinicName} میں ${p.when} کی اپائنٹمنٹ سے محروم رہے۔ اگر اب بھی ضرورت ہو تو براہ کرم دوبارہ بک کریں۔`,
  },
  waitlist_slot_available: {
    en: (p) =>
      `A slot opened up with ${p.practitionerName} at ${p.clinicName} on ${p.requestedDate} — you're first on the waitlist. Book it before it's gone.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ ${p.clinicName} میں ${p.requestedDate} کو ایک وقت خالی ہو گیا ہے — آپ ویٹ لسٹ میں سب سے پہلے ہیں۔ جلد بک کریں۔`,
  },
  staff_invited: {
    en: (p) =>
      `${p.inviterName} added you as a ${STAFF_ROLE_LABELS.en[p.role ?? ''] ?? p.role} at ${p.clinicName}. Open it from the clinic switcher in your dashboard.`,
    ur: (p) =>
      `${p.inviterName} نے آپ کو ${p.clinicName} میں ${STAFF_ROLE_LABELS.ur[p.role ?? ''] ?? p.role} کے طور پر شامل کیا ہے۔ اسے اپنے ڈیش بورڈ میں کلینک سوئچر سے کھولیں۔`,
  },
};

export function renderTemplate(
  key: TemplateKey,
  locale: 'en' | 'ur',
  payload: Record<string, string>,
): string {
  return templates[key][locale](payload);
}
