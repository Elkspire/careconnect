-- Star ratings + optional comment, one per patient per practitioner (a
-- second submission updates their existing review rather than creating a
-- duplicate — see the API's upsert). Additive migration — 0001 already
-- shipped conceptually, don't edit it in place.

create table practitioner_reviews (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references practitioners (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (practitioner_id, patient_id)
);
create index practitioner_reviews_practitioner_idx on practitioner_reviews (practitioner_id);

alter table practitioner_reviews enable row level security;

-- Defense-in-depth only (see 0001_init.sql's RLS note) — the API is the
-- primary enforcement path.
create policy "practitioner_reviews_select_all"
  on practitioner_reviews for select using (true);

create policy "practitioner_reviews_manage_own"
  on practitioner_reviews for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
