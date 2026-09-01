-- Practitioner verification review: the product doc's own first "open
-- question," previously unresolved — verification_status gated directory
-- visibility but nothing let anyone actually review a submission and flip
-- it, so it was a hand-edited database column. This adds the minimum
-- needed to make it a real workflow: a reason field for a rejection, and a
-- platform-operator allowlist to gate who can call the verify/reject
-- endpoints (see AdminGuard).
--
-- Scope note: this reviews what the platform actually captures today —
-- name, registration number, practitioner type. Document upload (CNIC,
-- degree, registration certificate — named in the product doc's own
-- verification screen) was never built and isn't part of this pass; an
-- admin is reviewing a registration number by eye, not a scanned
-- document. That's a real, separate gap, not solved here.

alter table practitioners add column verification_note text;

create table platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- No policy at all beyond RLS-enabled-with-no-policies, which defaults to
-- deny-all for anyone without the elevated service-role connection the API
-- uses — there's no legitimate direct-client read/write path to this
-- table, unlike every other RLS table in this schema which has an "own
-- row" policy for the API-bypassing Storage/Realtime paths.
