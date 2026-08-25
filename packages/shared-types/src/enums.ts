/**
 * Hand-authored enums mirroring the Postgres enum types defined in
 * supabase/migrations/0001_init.sql. Keep these in sync manually — they are
 * the TS-side source of truth that packages/validation builds Zod enums from.
 */

export const GENDER = ["male", "female", "other"] as const;
export type Gender = (typeof GENDER)[number];

export const PREFERRED_LANGUAGE = ["en", "ur"] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGE)[number];

export const FAMILY_RELATIONSHIP = [
  "spouse",
  "child",
  "parent",
  "sibling",
  "other",
  // Added in 0007_specific_relationships.sql — the family member form offers
  // these instead of the generic spouse/child/parent buckets above; those
  // three (plus sibling/other) stay in the enum for any pre-existing rows.
  "husband",
  "wife",
  "son",
  "daughter",
  "mother",
  "father",
] as const;
export type FamilyRelationship = (typeof FAMILY_RELATIONSHIP)[number];

export const PRACTITIONER_TYPE = [
  "doctor",
  "dentist",
  "physiotherapist",
  "psychologist",
  "nutritionist",
  "homeopath",
  "lab_diagnostic",
] as const;
export type PractitionerType = (typeof PRACTITIONER_TYPE)[number];

export const VERIFICATION_STATUS = ["unverified", "pending", "verified"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const APPOINTMENT_SUBJECT_TYPE = ["self", "family_member"] as const;
export type AppointmentSubjectType = (typeof APPOINTMENT_SUBJECT_TYPE)[number];

export const APPOINTMENT_STATUS = [
  "booked",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const WAITLIST_STATUS = [
  "waiting",
  "offered",
  "converted",
  "expired",
  "cancelled",
] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUS)[number];

/**
 * v1 intentionally supports only owner|receptionist. Do not add
 * junior_doctor/assistant here until the v2 permissions matrix is built —
 * see product doc section 3.5 and the Phase 1 plan's RBAC note.
 */
export const CLINIC_STAFF_ROLE = ["owner", "receptionist"] as const;
export type ClinicStaffRole = (typeof CLINIC_STAFF_ROLE)[number];

export const CLINIC_STAFF_STATUS = ["invited", "active", "revoked"] as const;
export type ClinicStaffStatus = (typeof CLINIC_STAFF_STATUS)[number];

export const RECORD_TYPE = ["prescription_photo", "lab_report", "other_document"] as const;
export type RecordType = (typeof RECORD_TYPE)[number];

/** v1 only ever writes 'patient_upload'; 'clinic_push' is reserved for v2. */
export const RECORD_SOURCE = ["patient_upload", "clinic_push"] as const;
export type RecordSource = (typeof RECORD_SOURCE)[number];

export const AUDIT_ACTION = ["view", "create", "update", "delete", "export"] as const;
export type AuditAction = (typeof AUDIT_ACTION)[number];

export const NOTIFICATION_CHANNEL = ["sms", "whatsapp", "push", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

export const NOTIFICATION_STATUS = ["queued", "sent", "delivered", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];
