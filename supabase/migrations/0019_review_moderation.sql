-- Review moderation mechanism — the product doc lists "review moderation
-- policy" as an open question to answer before building, which is a
-- business decision (what's reportable, who moderates, SLA) not an
-- engineering one. This ships the mechanism a policy would need either
-- way: a practitioner can report a review of themselves, a platform admin
-- can hide/unhide it. Hidden reviews are excluded from the public
-- rating/summary a patient sees, but never deleted — reversible, and an
-- admin can see why it was reported.

alter table practitioner_reviews add column hidden boolean not null default false;

create table review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references practitioner_reviews(id) on delete cascade,
  reported_by uuid not null references practitioners(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create index review_reports_review_idx on review_reports (review_id);

alter table review_reports enable row level security;

-- Defense-in-depth only, matching the rest of this schema — the API
-- connects with elevated privileges that bypass RLS for ordinary traffic.
create policy "review_reports_practitioner_read_own"
  on review_reports for select
  using (reported_by = auth.uid());
