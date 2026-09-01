/**
 * Hand-authored Drizzle schema mirroring supabase/migrations/0001_init.sql.
 *
 * This should normally be generated via `drizzle-kit pull` against a running
 * local Supabase instance (see package.json's `db:pull` script), which is
 * the source of truth going forward. It was hand-written here because no
 * local Postgres was available to introspect at the time this was written —
 * run `pnpm --filter @careconnect/api db:pull` once Docker/Supabase are up
 * and diff the result against this file before trusting it further.
 */
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ---- auth schema (Supabase-managed; only the columns we FK against) ----

const authSchema = pgSchema('auth');
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  // Used only to look up an existing user by phone when inviting clinic
  // staff — see ClinicModule. Not a source of truth for anything else.
  phone: text('phone'),
});

// ---- enums ----

export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const preferredLanguageEnum = pgEnum('preferred_language', ['en', 'ur']);
export const familyRelationshipEnum = pgEnum('family_relationship', [
  'spouse',
  'child',
  'parent',
  'sibling',
  'other',
  // Added in 0007_specific_relationships.sql.
  'husband',
  'wife',
  'son',
  'daughter',
  'mother',
  'father',
]);
export const practitionerTypeEnum = pgEnum('practitioner_type', [
  'doctor',
  'dentist',
  'physiotherapist',
  'psychologist',
  'nutritionist',
  'homeopath',
  'lab_diagnostic',
]);
export const verificationStatusEnum = pgEnum('verification_status', [
  'unverified',
  'pending',
  'verified',
]);
export const appointmentSubjectTypeEnum = pgEnum('appointment_subject_type', [
  'self',
  'family_member',
]);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'booked',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
]);
export const waitlistStatusEnum = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'converted',
  'expired',
  'cancelled',
]);
// See packages/shared-types CLINIC_STAFF_ROLE for the permission summary —
// keep this list in sync with it, 0010_junior_doctor_role.sql, and
// 0016_assistant_role_vitals.sql.
export const clinicStaffRoleEnum = pgEnum('clinic_staff_role', [
  'owner',
  'receptionist',
  'junior_doctor',
  'assistant',
]);
export const clinicStaffStatusEnum = pgEnum('clinic_staff_status', [
  'invited',
  'active',
  'revoked',
]);
export const bloodGroupEnum = pgEnum('blood_group', [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
]);
export const recordTypeEnum = pgEnum('record_type', [
  'prescription_photo',
  'lab_report',
  'other_document',
]);
export const recordSourceEnum = pgEnum('record_source', [
  'patient_upload',
  'clinic_push',
]);
export const auditActionEnum = pgEnum('audit_action', [
  'view',
  'create',
  'update',
  'delete',
  'export',
]);
export const notificationChannelEnum = pgEnum('notification_channel', [
  'sms',
  'whatsapp',
  'push',
  'in_app',
]);
export const notificationStatusEnum = pgEnum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
]);

// ---- identity ----

export const patients = pgTable('patients', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  gender: genderEnum('gender'),
  dob: date('dob'),
  preferredLanguage: preferredLanguageEnum('preferred_language')
    .notNull()
    .default('en'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const practitioners = pgTable('practitioners', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  fullName: text('full_name').notNull(),
  gender: genderEnum('gender'),
  practitionerType: practitionerTypeEnum('practitioner_type').notNull(),
  councilRegistrationNo: text('council_registration_no').notNull(),
  verificationStatus: verificationStatusEnum('verification_status')
    .notNull()
    .default('unverified'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  // Set by AdminService.reject — an unverified/pending profile stays
  // invisible in the directory either way; this is just why, for the
  // practitioner's and the next reviewer's benefit. Cleared on verify.
  verificationNote: text('verification_note'),
  bio: text('bio'),
  languages: text('languages').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Platform-operator allowlist — deliberately not a clinic_staff role or a
 * column on patients/practitioners: an admin isn't tied to any one
 * clinic or acting as a patient/doctor, they're reviewing the whole
 * directory. No self-serve way to join this table on purpose; the first
 * (and so far only) admin is granted with a direct database insert. See
 * AdminGuard for enforcement.
 */
export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Added in 0006_practitioner_reviews.sql. 0008_review_per_visit.sql briefly
// moved this to one-per-appointment; 0009_revert_review_per_visit.sql put it
// back to one-per-(practitioner,patient) — a resubmission updates the
// patient's existing review rather than creating a second one.
export const practitionerReviews = pgTable(
  'practitioner_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('practitioner_reviews_practitioner_idx').on(t.practitionerId),
    unique().on(t.practitionerId, t.patientId),
  ],
);

export const familyMembers = pgTable(
  'family_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    relationship: familyRelationshipEnum('relationship').notNull(),
    dob: date('dob'),
    gender: genderEnum('gender'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('family_members_patient_id_idx').on(t.patientId)],
);

// ---- directory ----

export const specialties = pgTable('specialties', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: text('name_en').notNull(),
  nameUr: text('name_ur'),
  practitionerType: practitionerTypeEnum('practitioner_type').notNull(),
});

export const practitionerSpecialties = pgTable(
  'practitioner_specialties',
  {
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    specialtyId: uuid('specialty_id')
      .notNull()
      .references(() => specialties.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.practitionerId, t.specialtyId] })],
);

export const clinics = pgTable(
  'clinics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    ownerPractitionerId: uuid('owner_practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    city: text('city').notNull(),
    area: text('area').notNull(),
    address: text('address').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    phone: text('phone'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('clinics_owner_idx').on(t.ownerPractitionerId),
    index('clinics_city_area_idx').on(t.city, t.area),
  ],
);

export const practitionerClinic = pgTable(
  'practitioner_clinic',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    consultationFee: numeric('consultation_fee', {
      precision: 10,
      scale: 2,
    }).notNull(),
    slotLengthMinutes: integer('slot_length_minutes').notNull(),
    dailyPatientCap: integer('daily_patient_cap'),
    timings: jsonb('timings').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    // Added in 0002_cancellation_window.sql.
    cancellationWindowHours: integer('cancellation_window_hours')
      .notNull()
      .default(24),
  },
  (t) => [
    unique('practitioner_clinic_practitioner_id_clinic_id_unique').on(
      t.practitionerId,
      t.clinicId,
    ),
    index('practitioner_clinic_clinic_idx').on(t.clinicId),
    index('practitioner_clinic_practitioner_idx').on(t.practitionerId),
  ],
);

export const practitionerLeave = pgTable(
  'practitioner_leave',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    clinicId: uuid('clinic_id').references(() => clinics.id, {
      onDelete: 'cascade',
    }),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    reason: text('reason'),
  },
  (t) => [index('practitioner_leave_practitioner_idx').on(t.practitionerId)],
);

// ---- booking ----

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    subjectType: appointmentSubjectTypeEnum('subject_type')
      .notNull()
      .default('self'),
    familyMemberId: uuid('family_member_id').references(
      () => familyMembers.id,
      {
        onDelete: 'set null',
      },
    ),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    scheduledStart: timestamp('scheduled_start', {
      withTimezone: true,
    }).notNull(),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }).notNull(),
    status: appointmentStatusEnum('status').notNull().default('booked'),
    bookedByUserId: uuid('booked_by_user_id')
      .notNull()
      .references(() => authUsers.id),
    cancellationReason: text('cancellation_reason'),
    cancelledByUserId: uuid('cancelled_by_user_id').references(
      () => authUsers.id,
    ),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('appointments_clinic_start_idx').on(t.clinicId, t.scheduledStart),
    index('appointments_practitioner_start_idx').on(
      t.practitionerId,
      t.scheduledStart,
    ),
    index('appointments_patient_idx').on(t.patientId),
  ],
);

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    subjectType: appointmentSubjectTypeEnum('subject_type')
      .notNull()
      .default('self'),
    familyMemberId: uuid('family_member_id').references(
      () => familyMembers.id,
      {
        onDelete: 'set null',
      },
    ),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    requestedDate: date('requested_date').notNull(),
    status: waitlistStatusEnum('status').notNull().default('waiting'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('waitlist_queue_idx').on(
      t.practitionerId,
      t.clinicId,
      t.requestedDate,
      t.status,
      t.createdAt,
    ),
    index('waitlist_patient_idx').on(t.patientId),
  ],
);

// ---- clinical boundary (isolated table — see ClinicalModule) ----

export const clinicalNotes = pgTable(
  'clinical_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .unique()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    notes: text('notes').notNull(),
    diagnosis: text('diagnosis'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('clinical_notes_patient_idx').on(t.patientId),
    index('clinical_notes_practitioner_idx').on(t.practitionerId),
  ],
);

/**
 * A structured line item on a visit's prescription — the "Rx pad" from the
 * product doc/journeys, alongside (not replacing) clinical_notes' free-text
 * notes/diagnosis. One clinical note has zero or more of these; saving a
 * prescription replaces the whole set for that note (see
 * ClinicalService.savePrescription) rather than editing lines individually,
 * so there's no per-item update/delete route. Same table-isolation
 * boundary as clinical_notes — never touched outside ClinicalService.
 */
export const prescriptionItems = pgTable(
  'prescription_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicalNoteId: uuid('clinical_note_id')
      .notNull()
      .references(() => clinicalNotes.id, { onDelete: 'cascade' }),
    drugName: text('drug_name').notNull(),
    dosage: text('dosage'),
    frequency: text('frequency'),
    duration: text('duration'),
    instructions: text('instructions'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('prescription_items_note_idx').on(t.clinicalNoteId)],
);

// ---- clinic RBAC ----

export const clinicStaff = pgTable(
  'clinic_staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    role: clinicStaffRoleEnum('role').notNull(),
    status: clinicStaffStatusEnum('status').notNull().default('invited'),
    invitedBy: uuid('invited_by').references(() => authUsers.id),
    revokedPermissions: text('revoked_permissions')
      .array()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('clinic_staff_clinic_id_user_id_unique').on(t.clinicId, t.userId),
    index('clinic_staff_user_idx').on(t.userId),
    index('clinic_staff_clinic_idx').on(t.clinicId),
  ],
);

/**
 * "A junior doctor sees the patients assigned to them, not the whole
 * practice" (product doc 3.5 / journeys.html's junior-doctor track) — the
 * owner explicitly assigns a patient (or one specific family member) to a
 * junior doctor; everything clinical ClinicService/ClinicalService expose
 * to a junior_doctor caller is filtered through this table. Owner and
 * receptionist are never scoped by it — this only narrows junior_doctor.
 */
export const patientAssignments = pgTable(
  'patient_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    juniorDoctorUserId: uuid('junior_doctor_user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    subjectType: appointmentSubjectTypeEnum('subject_type')
      .notNull()
      .default('self'),
    familyMemberId: uuid('family_member_id').references(
      () => familyMembers.id,
      { onDelete: 'cascade' },
    ),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('patient_assignments_lookup_idx').on(
      t.clinicId,
      t.juniorDoctorUserId,
      t.patientId,
    ),
  ],
);

/**
 * The assistant role's actual job (journeys.html's "Assistant" track,
 * step 01): blood pressure/pulse/weight/temperature taken before the
 * doctor's consultation, attributed to whoever recorded them. One row per
 * appointment — 'save vitals' is a single action in the product doc, not
 * an editable log, so this is an upsert target, not an append-only series.
 * All four measurements are individually optional (a busy assistant may
 * not always get all four), but the API requires at least one.
 */
export const vitals = pgTable('vitals', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  systolicMmhg: smallint('systolic_mmhg'),
  diastolicMmhg: smallint('diastolic_mmhg'),
  pulseBpm: smallint('pulse_bpm'),
  weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),
  temperatureF: numeric('temperature_f', { precision: 4, scale: 1 }),
  recordedBy: uuid('recorded_by')
    .notNull()
    .references(() => authUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- patient vault ----

export const patientRecords = pgTable(
  'patient_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    subjectType: appointmentSubjectTypeEnum('subject_type')
      .notNull()
      .default('self'),
    familyMemberId: uuid('family_member_id').references(
      () => familyMembers.id,
      {
        onDelete: 'set null',
      },
    ),
    recordType: recordTypeEnum('record_type').notNull(),
    source: recordSourceEnum('source').notNull().default('patient_upload'),
    filePath: text('file_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    linkedAppointmentId: uuid('linked_appointment_id').references(
      () => appointments.id,
      {
        onDelete: 'set null',
      },
    ),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('patient_records_patient_idx').on(t.patientId)],
);

/**
 * The "flagged prominently" summary from the product doc's clinic-side
 * patient view — allergies, chronic conditions, blood group, active
 * medications. One row per subject (self or a family member), not per
 * upload: unlike patient_records this is a small structured fact sheet,
 * kept current rather than accumulated. Both the patient and any clinic
 * they've visited can write to it (patient-owns-the-record: doctors write,
 * the patient always keeps read/write on their own copy) — same
 * clinical-sensitivity boundary as patient_records for who at a clinic can
 * reach it (owner/junior_doctor, never receptionist).
 */
export const medicalSummaries = pgTable(
  'medical_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    subjectType: appointmentSubjectTypeEnum('subject_type')
      .notNull()
      .default('self'),
    familyMemberId: uuid('family_member_id').references(
      () => familyMembers.id,
      {
        onDelete: 'cascade',
      },
    ),
    bloodGroup: bloodGroupEnum('blood_group'),
    allergies: text('allergies').array().notNull().default([]),
    chronicConditions: text('chronic_conditions').array().notNull().default([]),
    activeMedications: text('active_medications').array().notNull().default([]),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => authUsers.id),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // One row per subject: enforced with two partial unique indexes in
  // 0012_medical_summaries.sql (family_member_id is nullable, so a single
  // plain unique(patientId, subjectType, familyMemberId) constraint would
  // let NULL != NULL admit multiple "self" rows) — MedicalSummaryService's
  // upsert also selects-then-branches rather than relying on
  // onConflictDoUpdate against a partial index.
  (t) => [index('medical_summaries_patient_idx').on(t.patientId)],
);

// ---- audit ----

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => authUsers.id),
    actorRole: text('actor_role').notNull(),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    clinicId: uuid('clinic_id').references(() => clinics.id, {
      onDelete: 'set null',
    }),
    patientId: uuid('patient_id').references(() => patients.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorUserId),
    index('audit_log_resource_idx').on(t.resourceType, t.resourceId),
  ],
);

// ---- notifications ----

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => authUsers.id),
    relatedAppointmentId: uuid('related_appointment_id').references(
      () => appointments.id,
      {
        onDelete: 'set null',
      },
    ),
    status: notificationStatusEnum('status').notNull().default('queued'),
    providerMessageId: text('provider_message_id'),
    // Added in 0003_notification_message.sql.
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('notification_log_recipient_idx').on(t.recipientUserId)],
);

// Added in 0005_push_subscriptions.sql.
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)],
);
