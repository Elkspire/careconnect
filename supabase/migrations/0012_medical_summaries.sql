-- The "flagged prominently" summary from the product doc's clinic-side
-- patient view: allergies, chronic conditions, blood group, active
-- medications. One row per subject (self or a family member) — a small,
-- kept-current fact sheet, not an accumulating upload like patient_records.
-- Both the patient and any clinic they've visited can write to it: the
-- patient always keeps read/write on their own copy (patient owns the
-- record), and a treating clinic (owner/junior_doctor, never
-- receptionist — same clinical boundary as clinical_notes) can add what it
-- discovers during a visit.

create type blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

create table medical_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  subject_type appointment_subject_type not null default 'self',
  family_member_id uuid references family_members(id) on delete cascade,
  blood_group blood_group,
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  active_medications text[] not null default '{}',
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create index medical_summaries_patient_idx on medical_summaries (patient_id);

-- One row per subject. A plain unique(patient_id, subject_type,
-- family_member_id) can't enforce this on its own — family_member_id is
-- NULL for every 'self' row, and Postgres treats NULL as distinct from
-- NULL, so it would happily admit multiple 'self' rows per patient. Two
-- partial indexes instead, one per subject shape.
create unique index medical_summaries_self_unique
  on medical_summaries (patient_id)
  where subject_type = 'self';
create unique index medical_summaries_family_member_unique
  on medical_summaries (family_member_id)
  where subject_type = 'family_member';

alter table medical_summaries enable row level security;

-- Defense-in-depth only, matching patient_records — the NestJS API is the
-- actual enforcement (MedicalSummaryService), connecting with elevated
-- privileges that bypass RLS entirely for ordinary request traffic.
create policy "medical_summaries_all_own"
  on medical_summaries for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
