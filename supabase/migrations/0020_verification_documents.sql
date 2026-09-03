-- Admin verification currently only reviews what a practitioner typed
-- into a form (registration number, name) — there was never a document
-- upload/review step, despite the product doc listing CNIC/degree/
-- registration certificate as what verification should actually check.
-- This is that: a practitioner uploads documents, an admin views them
-- (via a signed URL, same pattern as patient-records) before verifying.

create type verification_document_type as enum (
  'cnic',
  'degree',
  'council_registration',
  'other'
);

create table practitioner_verification_documents (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  document_type verification_document_type not null,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  uploaded_at timestamptz not null default now()
);

create index practitioner_verification_documents_practitioner_idx
  on practitioner_verification_documents (practitioner_id);

alter table practitioner_verification_documents enable row level security;

-- Defense-in-depth only, matching the rest of this schema — the API
-- connects with elevated privileges that bypass RLS for ordinary traffic.
create policy "verification_documents_owner_read"
  on practitioner_verification_documents for select
  using (practitioner_id = auth.uid());

-- =========================================================================
-- Storage: practitioner verification documents
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('practitioner-documents', 'practitioner-documents', false)
on conflict (id) do nothing;

-- Convention: object path is "{practitioner_id}/{document_id}/{file_name}",
-- same as the patient-records bucket in 0001_init.sql.
create policy "verification_documents_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'practitioner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "verification_documents_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'practitioner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "verification_documents_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'practitioner-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
