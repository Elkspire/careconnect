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
 * owner: full practice access (staff, fees, schedule, all clinical data).
 * receptionist: calendar/check-in/billing only — no clinical access, ever.
 * junior_doctor: patient histories + clinical notes (co-authored under the
 * owner's practice), but no staff/fee/schedule management. See product doc
 * section 3.5. assistant: records vitals and attaches reports before the
 * consult — never notes, prescriptions, or diagnosis (journeys.html's
 * "Assistant" track).
 */
export const CLINIC_STAFF_ROLE = [
  "owner",
  "receptionist",
  "junior_doctor",
  "assistant",
] as const;
export type ClinicStaffRole = (typeof CLINIC_STAFF_ROLE)[number];

export const CLINIC_STAFF_STATUS = ["invited", "active", "revoked"] as const;
export type ClinicStaffStatus = (typeof CLINIC_STAFF_STATUS)[number];

export type AssignableStaffRole = Exclude<ClinicStaffRole, "owner">;

/**
 * Fine-grained capabilities ClinicRoleGuard checks in addition to the
 * coarse role list on a route (see RequireStaffPermission). Mirrors the
 * Staff page's permission matrix in apps/web.
 */
export const STAFF_PERMISSION_KEY = [
  "viewPatientList",
  "viewTodayQueue",
  "checkInPatients",
  "viewRecords",
  "clinicalNotes",
  "manageStaff",
  "manageFeesSchedule",
  "recordVitals",
] as const;
export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEY)[number];

/**
 * The most each assignable role can ever be granted. clinic_staff.
 * revoked_permissions (see 0011_staff_permission_overrides.sql) lets a
 * doctor narrow a specific staff member below their role's ceiling —
 * never past it. manageStaff/manageFeesSchedule stay owner-only
 * structurally (their routes never list another role), so they never
 * appear here. junior_doctor gets recordVitals too — read-only in
 * practice, since ClinicController's write route only ever lists
 * owner/assistant regardless of this ceiling — so a doctor sees vitals
 * taken before their consult (journeys.html: "she opens the consultation
 * knowing... today's blood pressure").
 */
export const ROLE_PERMISSION_CEILING: Record<AssignableStaffRole, StaffPermissionKey[]> = {
  receptionist: ["viewPatientList", "viewTodayQueue", "checkInPatients"],
  junior_doctor: [
    "viewPatientList",
    "viewTodayQueue",
    "viewRecords",
    "clinicalNotes",
    "recordVitals",
  ],
  assistant: ["viewTodayQueue", "recordVitals"],
};

export const BLOOD_GROUP = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
export type BloodGroup = (typeof BLOOD_GROUP)[number];

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
