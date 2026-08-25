-- CareConnect v1 schema: identity, directory, booking, clinical boundary,
-- clinic RBAC, patient vault, audit, notifications.
-- See Phase 1 plan (careconnect resources) for the RLS/enforcement rationale.

-- =========================================================================
-- Enums
-- =========================================================================

create type gender as enum ('male', 'female', 'other');
create type preferred_language as enum ('en', 'ur');
create type family_relationship as enum ('spouse', 'child', 'parent', 'sibling', 'other');
create type practitioner_type as enum (
  'doctor', 'dentist', 'physiotherapist', 'psychologist',
  'nutritionist', 'homeopath', 'lab_diagnostic'
);
create type verification_status as enum ('unverified', 'pending', 'verified');
create type appointment_subject_type as enum ('self', 'family_member');
create type appointment_status as enum (
  'booked', 'checked_in', 'completed', 'cancelled', 'no_show'
);
create type waitlist_status as enum (
  'waiting', 'offered', 'converted', 'expired', 'cancelled'
);
-- v1 intentionally supports only owner|receptionist. Do not add
-- junior_doctor/assistant until the v2 permissions matrix is built.
create type clinic_staff_role as enum ('owner', 'receptionist');
create type clinic_staff_status as enum ('invited', 'active', 'revoked');
create type record_type as enum ('prescription_photo', 'lab_report', 'other_document');
-- v1 only ever writes 'patient_upload'; 'clinic_push' is reserved for v2.
create type record_source as enum ('patient_upload', 'clinic_push');
create type audit_action as enum ('view', 'create', 'update', 'delete', 'export');
create type notification_channel as enum ('sms', 'whatsapp', 'push', 'in_app');
create type notification_status as enum ('queued', 'sent', 'delivered', 'failed');

-- =========================================================================
-- updated_at helper
-- =========================================================================

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================================
-- Identity
-- =========================================================================

create table patients (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  gender gender,
  dob date,
  preferred_language preferred_language not null default 'en',
  email text,
  created_at timestamptz not null default now()
);

create table practitioners (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  gender gender,
  practitioner_type practitioner_type not null,
  council_registration_no text not null,
  verification_status verification_status not null default 'unverified',
  verified_at timestamptz,
  bio text,
  languages text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  full_name text not null,
  relationship family_relationship not null,
  dob date,
  gender gender,
  created_at timestamptz not null default now()
);
create index family_members_patient_id_idx on family_members (patient_id);

-- =========================================================================
-- Directory
-- =========================================================================

create table specialties (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ur text,
  practitioner_type practitioner_type not null
);

create table practitioner_specialties (
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  specialty_id uuid not null references specialties (id) on delete cascade,
  primary key (practitioner_id, specialty_id)
);

create table clinics (
  id uuid primary key default gen_random_uuid(),
  owner_practitioner_id uuid not null references practitioners (id) on delete cascade,
  name text not null,
  city text not null,
  area text not null,
  address text not null,
  lat double precision,
  lng double precision,
  phone text,
  created_at timestamptz not null default now()
);
create index clinics_owner_idx on clinics (owner_practitioner_id);
create index clinics_city_area_idx on clinics (city, area);

create table practitioner_clinic (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  clinic_id uuid not null references clinics (id) on delete cascade,
  consultation_fee numeric(10, 2) not null,
  slot_length_minutes int not null check (slot_length_minutes between 5 and 240),
  daily_patient_cap int check (daily_patient_cap > 0),
  -- { mon: [{start:"09:00", end:"13:00"}], tue: [...], ... }
  timings jsonb not null default '{}',
  is_active boolean not null default true,
  unique (practitioner_id, clinic_id)
);
create index practitioner_clinic_clinic_idx on practitioner_clinic (clinic_id);
create index practitioner_clinic_practitioner_idx on practitioner_clinic (practitioner_id);

create table practitioner_leave (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  clinic_id uuid references clinics (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  check (starts_on <= ends_on)
);
create index practitioner_leave_practitioner_idx on practitioner_leave (practitioner_id);

-- =========================================================================
-- Booking
-- =========================================================================
-- No persisted slots table: availability is computed at query time from
-- practitioner_clinic.timings minus appointments minus practitioner_leave.

create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  subject_type appointment_subject_type not null default 'self',
  family_member_id uuid references family_members (id) on delete set null,
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  clinic_id uuid not null references clinics (id) on delete cascade,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status appointment_status not null default 'booked',
  booked_by_user_id uuid not null references auth.users (id),
  cancellation_reason text,
  cancelled_by_user_id uuid references auth.users (id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subject_type <> 'family_member' or family_member_id is not null),
  check (scheduled_end > scheduled_start)
);
create index appointments_clinic_start_idx on appointments (clinic_id, scheduled_start);
create index appointments_practitioner_start_idx on appointments (practitioner_id, scheduled_start);
create index appointments_patient_idx on appointments (patient_id);

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  subject_type appointment_subject_type not null default 'self',
  family_member_id uuid references family_members (id) on delete set null,
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  clinic_id uuid not null references clinics (id) on delete cascade,
  requested_date date not null,
  status waitlist_status not null default 'waiting',
  created_at timestamptz not null default now(),
  check (subject_type <> 'family_member' or family_member_id is not null)
);
-- Queue position is computed by ordering created_at within this key, not stored.
create index waitlist_queue_idx
  on waitlist_entries (practitioner_id, clinic_id, requested_date, status, created_at);
create index waitlist_patient_idx on waitlist_entries (patient_id);

-- =========================================================================
-- Clinical boundary — physically separate table.
-- No receptionist code path (NestJS guard or RLS policy) ever touches this
-- table. See ClinicalModule in the API and the clinical_notes RLS policy
-- below, which must stay in agreement.
-- =========================================================================

create table clinical_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  notes text not null,
  diagnosis text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clinical_notes_patient_idx on clinical_notes (patient_id);
create index clinical_notes_practitioner_idx on clinical_notes (practitioner_id);

create trigger clinical_notes_set_updated_at
  before update on clinical_notes
  for each row execute function set_updated_at();

-- =========================================================================
-- Clinic RBAC — scoped per clinic, not per user globally.
-- =========================================================================

create table clinic_staff (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role clinic_staff_role not null,
  status clinic_staff_status not null default 'invited',
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);
create index clinic_staff_user_idx on clinic_staff (user_id);
create index clinic_staff_clinic_idx on clinic_staff (clinic_id);

-- =========================================================================
-- Patient vault — patient-owned, works before any clinic is on the platform.
-- =========================================================================

create table patient_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  subject_type appointment_subject_type not null default 'self',
  family_member_id uuid references family_members (id) on delete set null,
  record_type record_type not null,
  source record_source not null default 'patient_upload',
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  linked_appointment_id uuid references appointments (id) on delete set null,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (subject_type <> 'family_member' or family_member_id is not null)
);
create index patient_records_patient_idx on patient_records (patient_id);

-- =========================================================================
-- Audit log — written by the NestJS AuditLogInterceptor, not DB triggers,
-- so it can capture *how* a record was accessed, not just that it was.
-- =========================================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id),
  actor_role text not null,
  action audit_action not null,
  resource_type text not null,
  resource_id uuid,
  clinic_id uuid references clinics (id) on delete set null,
  patient_id uuid references patients (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_actor_idx on audit_log (actor_user_id);
create index audit_log_resource_idx on audit_log (resource_type, resource_id);

-- =========================================================================
-- Notification delivery log
-- =========================================================================

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel notification_channel not null,
  recipient_user_id uuid not null references auth.users (id),
  related_appointment_id uuid references appointments (id) on delete set null,
  status notification_status not null default 'queued',
  provider_message_id text,
  created_at timestamptz not null default now()
);
create index notification_log_recipient_idx on notification_log (recipient_user_id);

-- =========================================================================
-- Row Level Security
--
-- Defense-in-depth, not the primary enforcement path: the NestJS API
-- connects with elevated privileges, so RLS does not run for API-mediated
-- traffic (guards/services in apps/api are primary enforcement there).
-- RLS matters for the two paths that run under the end user's own Supabase
-- session: Storage objects behind patient_records, and an optional
-- Realtime subscription on `appointments` for the clinic "today" dashboard.
-- =========================================================================

alter table patients enable row level security;
alter table family_members enable row level security;
alter table practitioners enable row level security;
alter table specialties enable row level security;
alter table practitioner_specialties enable row level security;
alter table clinics enable row level security;
alter table practitioner_clinic enable row level security;
alter table practitioner_leave enable row level security;
alter table appointments enable row level security;
alter table waitlist_entries enable row level security;
alter table clinical_notes enable row level security;
alter table clinic_staff enable row level security;
alter table patient_records enable row level security;
alter table audit_log enable row level security;
alter table notification_log enable row level security;

-- Patients: own row only.
create policy "patients_select_own" on patients for select using (id = auth.uid());
create policy "patients_insert_own" on patients for insert with check (id = auth.uid());
create policy "patients_update_own" on patients for update using (id = auth.uid());

-- Family members: managed only through the owning patient's session.
create policy "family_members_all_own"
  on family_members for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Practitioners: public read (unverified listings must still be visible,
-- just visually distinct per the product doc); self-managed profile only.
-- verification_status is changed by an admin path in the API, which uses
-- the service-role connection and therefore bypasses this policy.
create policy "practitioners_select_public" on practitioners for select using (true);
create policy "practitioners_insert_own" on practitioners for insert with check (id = auth.uid());
create policy "practitioners_update_own" on practitioners for update using (id = auth.uid());

-- Directory tables: public read; writes restricted to the owning practitioner.
create policy "specialties_select_public" on specialties for select using (true);

create policy "practitioner_specialties_select_public"
  on practitioner_specialties for select using (true);
create policy "practitioner_specialties_write_own"
  on practitioner_specialties for all
  using (practitioner_id = auth.uid())
  with check (practitioner_id = auth.uid());

create policy "clinics_select_public" on clinics for select using (true);
create policy "clinics_write_own"
  on clinics for all
  using (owner_practitioner_id = auth.uid())
  with check (owner_practitioner_id = auth.uid());

create policy "practitioner_clinic_select_public"
  on practitioner_clinic for select using (true);
create policy "practitioner_clinic_write_own"
  on practitioner_clinic for all
  using (practitioner_id = auth.uid())
  with check (practitioner_id = auth.uid());

create policy "practitioner_leave_select_public"
  on practitioner_leave for select using (true);
create policy "practitioner_leave_write_own"
  on practitioner_leave for all
  using (practitioner_id = auth.uid())
  with check (practitioner_id = auth.uid());

-- Appointments: the receptionist-visible surface. Patient owns their
-- bookings; active clinic staff (owner or receptionist) can see/manage
-- appointments at their clinic. No clinical fields live on this table.
create policy "appointments_select"
  on appointments for select
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = appointments.clinic_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );
create policy "appointments_insert"
  on appointments for insert
  with check (
    patient_id = auth.uid()
    or exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = appointments.clinic_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );
create policy "appointments_update"
  on appointments for update
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = appointments.clinic_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );

-- Waitlist: same shape as appointments.
create policy "waitlist_select"
  on waitlist_entries for select
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = waitlist_entries.clinic_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );
create policy "waitlist_insert"
  on waitlist_entries for insert
  with check (
    patient_id = auth.uid()
    or exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = waitlist_entries.clinic_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );
create policy "waitlist_update"
  on waitlist_entries for update
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = waitlist_entries.clinic_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );

-- Clinical notes: practitioner (the note's author) only. No branch ever
-- references clinic_staff, so a receptionist session gets zero rows even
-- if a future bug exposes this table to a direct client path.
create policy "clinical_notes_select_own"
  on clinical_notes for select using (practitioner_id = auth.uid());
create policy "clinical_notes_insert_own"
  on clinical_notes for insert with check (practitioner_id = auth.uid());
create policy "clinical_notes_update_own"
  on clinical_notes for update using (practitioner_id = auth.uid());

-- Clinic staff: visible to the staff member themself and to the clinic's
-- owner; only the owner can invite/edit/revoke.
create policy "clinic_staff_select"
  on clinic_staff for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from clinics c
      where c.id = clinic_staff.clinic_id and c.owner_practitioner_id = auth.uid()
    )
  );
create policy "clinic_staff_write_by_owner"
  on clinic_staff for all
  using (
    exists (
      select 1 from clinics c
      where c.id = clinic_staff.clinic_id and c.owner_practitioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from clinics c
      where c.id = clinic_staff.clinic_id and c.owner_practitioner_id = auth.uid()
    )
  );

-- Patient vault: patient's own session only. No clinic role ever satisfies
-- this policy in v1 (patient-upload only; clinic_push is v2).
create policy "patient_records_all_own"
  on patient_records for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Audit log: written by the trusted API layer (service-role, bypasses
-- RLS); actors may read their own entries as a courtesy/debug path.
create policy "audit_log_select_own"
  on audit_log for select using (actor_user_id = auth.uid());

-- Notification log: recipients may read their own delivery history.
create policy "notification_log_select_own"
  on notification_log for select using (recipient_user_id = auth.uid());

-- =========================================================================
-- Storage: patient vault files
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('patient-records', 'patient-records', false)
on conflict (id) do nothing;

-- Convention: object path is "{patient_id}/{record_id}/{file_name}", so the
-- first path segment is checked against the caller's own id.
create policy "patient_records_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'patient-records'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "patient_records_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'patient-records'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "patient_records_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'patient-records'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
