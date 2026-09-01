-- Structured prescription line items — the "Rx pad" from the product doc,
-- alongside (not replacing) clinical_notes' free-text notes/diagnosis.
-- Saving a prescription replaces the whole set for a visit (see
-- ClinicalService.savePrescription), so there's no independent RLS-visible
-- write path here beyond what clinical_notes already has.

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  clinical_note_id uuid not null references clinical_notes(id) on delete cascade,
  drug_name text not null,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index prescription_items_note_idx on prescription_items (clinical_note_id);

alter table prescription_items enable row level security;

-- Same shape as clinical_notes' own policy (practitioner_id = auth.uid()
-- only, no clinic_staff reference) — defense-in-depth only, since the API
-- connects with elevated privileges that bypass RLS for ordinary traffic.
-- A patient may also read their own prescriptions (patients/me/clinical-history).
create policy "prescription_items_practitioner_own"
  on prescription_items for all
  using (
    exists (
      select 1 from clinical_notes cn
      where cn.id = prescription_items.clinical_note_id
        and cn.practitioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from clinical_notes cn
      where cn.id = prescription_items.clinical_note_id
        and cn.practitioner_id = auth.uid()
    )
  );

create policy "prescription_items_patient_read_own"
  on prescription_items for select
  using (
    exists (
      select 1 from clinical_notes cn
      where cn.id = prescription_items.clinical_note_id
        and cn.patient_id = auth.uid()
    )
  );
