-- "A junior doctor sees the patients assigned to them, not the whole
-- practice" — previously a junior_doctor clinic_staff member could see
-- every patient at the clinic, same as the owner; the product doc and
-- reference journeys both treat assignment-gated visibility as the actual
-- design, not a blanket role. This table is that gate. Owner and
-- receptionist are never scoped by it.

create table patient_assignments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  junior_doctor_user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  subject_type appointment_subject_type not null default 'self',
  family_member_id uuid references family_members(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index patient_assignments_lookup_idx
  on patient_assignments (clinic_id, junior_doctor_user_id, patient_id);

alter table patient_assignments enable row level security;

-- Defense-in-depth only, matching the rest of this schema — the API
-- connects with elevated privileges that bypass RLS for ordinary traffic.
create policy "patient_assignments_junior_doctor_read_own"
  on patient_assignments for select
  using (junior_doctor_user_id = auth.uid());

create policy "patient_assignments_owner_manage"
  on patient_assignments for all
  using (
    exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = patient_assignments.clinic_id
        and cs.user_id = auth.uid()
        and cs.role = 'owner'
        and cs.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from clinic_staff cs
      where cs.clinic_id = patient_assignments.clinic_id
        and cs.user_id = auth.uid()
        and cs.role = 'owner'
        and cs.status = 'active'
    )
  );
