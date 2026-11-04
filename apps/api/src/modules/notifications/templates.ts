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

/** English, Urdu script, and Roman Urdu (Urdu in Latin letters). */
export const NOTIFICATION_LOCALES = ['en', 'ur', 'ur-Latn'] as const;
export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

/**
 * Anything that isn't a supported locale code becomes English. Matters for
 * practitioners: their notification language comes from the free-text
 * "languages spoken" field ("English", "Urdu", ...), which used to be cast
 * straight to a locale and crash renderTemplate on templates["English"].
 */
export function toNotificationLocale(
  value: string | null | undefined,
): NotificationLocale {
  const v = (value ?? '').trim();
  if ((NOTIFICATION_LOCALES as readonly string[]).includes(v)) {
    return v as NotificationLocale;
  }
  if (/^urdu$/i.test(v)) return 'ur';
  return 'en';
}

const STAFF_ROLE_LABELS: Record<NotificationLocale, Record<string, string>> = {
  en: { receptionist: 'Receptionist', junior_doctor: 'Junior Doctor' },
  ur: { receptionist: 'ریسیپشنسٹ', junior_doctor: 'جونیئر ڈاکٹر' },
  'ur-Latn': { receptionist: 'Receptionist', junior_doctor: 'Junior Doctor' },
};

const templates: Record<TemplateKey, Record<NotificationLocale, TemplateFn>> = {
  appointment_booked: {
    en: (p) =>
      `Your appointment with ${p.practitionerName} at ${p.clinicName} is confirmed for ${p.when}.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ ${p.clinicName} میں آپ کی اپائنٹمنٹ ${p.when} کے لیے کنفرم ہو گئی ہے۔`,
    'ur-Latn': (p) =>
      `${p.practitionerName} ke saath ${p.clinicName} mein aap ki appointment ${p.when} ke liye confirm ho gayi hai.`,
  },
  appointment_rescheduled: {
    en: (p) =>
      `Your appointment with ${p.practitionerName} has been moved to ${p.when}.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ آپ کی اپائنٹمنٹ ${p.when} پر منتقل کر دی گئی ہے۔`,
    'ur-Latn': (p) =>
      `${p.practitionerName} ke saath aap ki appointment ab ${p.when} par hai.`,
  },
  appointment_cancelled_by_patient: {
    en: (p) =>
      `Your appointment with ${p.practitionerName} on ${p.when} has been cancelled.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ ${p.when} کی آپ کی اپائنٹمنٹ منسوخ کر دی گئی ہے۔`,
    'ur-Latn': (p) =>
      `${p.practitionerName} ke saath ${p.when} ki aap ki appointment cancel kar di gayi hai.`,
  },
  appointment_cancelled_by_clinic: {
    en: (p) =>
      `${p.clinicName} has cancelled your appointment on ${p.when}. Please rebook at your convenience.`,
    ur: (p) =>
      `${p.clinicName} نے ${p.when} کی آپ کی اپائنٹمنٹ منسوخ کر دی ہے۔ براہ کرم دوبارہ بک کریں۔`,
    'ur-Latn': (p) =>
      `${p.clinicName} ne ${p.when} ki aap ki appointment cancel kar di hai. Apni suhoolat se dobara book karein.`,
  },
  appointment_reminder_24h: {
    en: (p) =>
      `Reminder: you have an appointment with ${p.practitionerName} tomorrow at ${p.when}.`,
    ur: (p) =>
      `یاد دہانی: کل ${p.when} پر ${p.practitionerName} کے ساتھ آپ کی اپائنٹمنٹ ہے۔`,
    'ur-Latn': (p) =>
      `Yaad dihani: kal ${p.when} par ${p.practitionerName} ke saath aap ki appointment hai.`,
  },
  appointment_reminder_2h: {
    en: (p) =>
      `Reminder: your appointment with ${p.practitionerName} is at ${p.when}, coming up soon.`,
    ur: (p) =>
      `یاد دہانی: ${p.practitionerName} کے ساتھ آپ کی اپائنٹمنٹ ${p.when} پر ہے، جلد شروع ہونے والی ہے۔`,
    'ur-Latn': (p) =>
      `Yaad dihani: ${p.practitionerName} ke saath aap ki appointment ${p.when} par hai, thori der mein shuru hogi.`,
  },
  patient_checked_in: {
    en: (p) => `${p.patientName} has checked in and is waiting.`,
    ur: (p) => `${p.patientName} چیک ان کر چکے ہیں اور انتظار میں ہیں۔`,
    'ur-Latn': (p) =>
      `${p.patientName} check in kar chuke hain aur intezar kar rahe hain.`,
  },
  appointment_no_show: {
    en: (p) =>
      `You missed your ${p.when} appointment with ${p.practitionerName} at ${p.clinicName}. Please rebook if you still need it.`,
    ur: (p) =>
      `آپ ${p.practitionerName} کے ساتھ ${p.clinicName} میں ${p.when} کی اپائنٹمنٹ سے محروم رہے۔ اگر اب بھی ضرورت ہو تو براہ کرم دوبارہ بک کریں۔`,
    'ur-Latn': (p) =>
      `Aap ${p.clinicName} mein ${p.practitionerName} ke saath ${p.when} ki appointment par nahin aa sake. Agar abhi bhi zaroorat ho to dobara book karein.`,
  },
  waitlist_slot_available: {
    en: (p) =>
      `A slot opened up with ${p.practitionerName} at ${p.clinicName} on ${p.requestedDate} — you're first on the waitlist. Book it before it's gone.`,
    ur: (p) =>
      `${p.practitionerName} کے ساتھ ${p.clinicName} میں ${p.requestedDate} کو ایک وقت خالی ہو گیا ہے — آپ ویٹ لسٹ میں سب سے پہلے ہیں۔ جلد بک کریں۔`,
    'ur-Latn': (p) =>
      `${p.practitionerName} ke saath ${p.clinicName} mein ${p.requestedDate} ko ek waqt khaali hua hai — aap waitlist mein sab se pehle hain. Jaldi book kar lein.`,
  },
  staff_invited: {
    en: (p) =>
      `${p.inviterName} added you as a ${STAFF_ROLE_LABELS.en[p.role ?? ''] ?? p.role} at ${p.clinicName}. Sign in with this phone number and choose "I'm clinic staff".`,
    ur: (p) =>
      `${p.inviterName} نے آپ کو ${p.clinicName} میں ${STAFF_ROLE_LABELS.ur[p.role ?? ''] ?? p.role} کے طور پر شامل کیا ہے۔ اسی فون نمبر سے سائن ان کریں اور "میں کلینک اسٹاف ہوں" منتخب کریں۔`,
    'ur-Latn': (p) =>
      `${p.inviterName} ne aap ko ${p.clinicName} mein ${STAFF_ROLE_LABELS['ur-Latn'][p.role ?? ''] ?? p.role} ke taur par shaamil kiya hai. Isi phone number se sign in karein aur "Main clinic staff hoon" chunein.`,
  },
};

export function renderTemplate(
  key: TemplateKey,
  locale: NotificationLocale,
  payload: Record<string, string>,
): string {
  return templates[key][locale](payload);
}
