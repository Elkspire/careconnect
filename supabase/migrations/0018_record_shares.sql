-- "The record is hers, and she decides who reads it" (journeys.html,
-- Patient · Step 07 — "Share for a second opinion"). Three controls: scope
-- (which of clinical history / lab reports / other vault records), a
-- fixed-window or revocable duration, and an access log. The token is the
-- only credential — a viewer never signs in, so record_share_accesses can
-- only ever record *that* the link was opened, not *who* by; that's an
-- honest limit of an unauthenticated link, not a shortcut taken here.

create table record_shares (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  subject_type appointment_subject_type not null default 'self',
  family_member_id uuid references family_members(id) on delete cascade,
  token text not null unique,
  include_clinical_history boolean not null default true,
  include_lab_reports boolean not null default true,
  include_other_records boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index record_shares_patient_idx on record_shares (patient_id);
create index record_shares_token_idx on record_shares (token);

create table record_share_accesses (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references record_shares(id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index record_share_accesses_share_idx on record_share_accesses (share_id);

alter table record_shares enable row level security;
alter table record_share_accesses enable row level security;

-- Defense-in-depth only, matching the rest of this schema — the API
-- connects with elevated privileges that bypass RLS for ordinary traffic,
-- and an anonymous share viewer never has a Supabase session at all, so
-- there is no policy that could grant them anything through this path.
create policy "record_shares_owner_read"
  on record_shares for select
  using (patient_id = auth.uid());

-- No policies at all on record_share_accesses (deny-all), matching
-- platform_admins' pattern — nobody needs a direct-client read on this.
