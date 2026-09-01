-- Vitals arrive before the patient does (journeys.html, Assistant · Step
-- 01): blood pressure/pulse/weight/temperature taken before the doctor's
-- consultation, attributed to whoever recorded them. One row per
-- appointment — "save vitals" is a single action in the product doc, not
-- an append-only log.

create table vitals (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  systolic_mmhg smallint,
  diastolic_mmhg smallint,
  pulse_bpm smallint,
  weight_kg numeric(5, 2),
  temperature_f numeric(4, 1),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vitals enable row level security;

-- Defense-in-depth only, matching the rest of this schema — the API
-- connects with elevated privileges that bypass RLS for ordinary traffic.
create policy "vitals_clinic_staff_read"
  on vitals for select
  using (
    exists (
      select 1 from appointments a
      join clinic_staff cs on cs.clinic_id = a.clinic_id
      where a.id = vitals.appointment_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
    )
  );

create policy "vitals_assistant_owner_write"
  on vitals for all
  using (
    exists (
      select 1 from appointments a
      join clinic_staff cs on cs.clinic_id = a.clinic_id
      where a.id = vitals.appointment_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
        and cs.role in ('owner', 'assistant')
    )
  )
  with check (
    exists (
      select 1 from appointments a
      join clinic_staff cs on cs.clinic_id = a.clinic_id
      where a.id = vitals.appointment_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
        and cs.role in ('owner', 'assistant')
    )
  );
