-- Reviews move from "one per patient per practitioner" (a resubmission
-- silently overwrote the previous review, which read as a bug: "my last
-- review disappeared") to one per visit: a patient can leave a new review
-- after each checked-in appointment, building a history over time.

alter table practitioner_reviews
  add column appointment_id uuid references appointments (id) on delete cascade;

-- Backfill: any pre-existing review was left against whichever appointment
-- granted its eligibility (see reviews.service.ts's ELIGIBLE_VISIT_STATUSES
-- check) — associate it explicitly instead of leaving it orphaned/null.
update practitioner_reviews r
set appointment_id = (
  select a.id from appointments a
  where a.patient_id = r.patient_id
    and a.practitioner_id = r.practitioner_id
    and a.status in ('checked_in', 'completed')
  order by a.scheduled_start desc
  limit 1
)
where appointment_id is null;

alter table practitioner_reviews
  alter column appointment_id set not null;

alter table practitioner_reviews
  drop constraint practitioner_reviews_practitioner_id_patient_id_key;

alter table practitioner_reviews
  add constraint practitioner_reviews_appointment_id_key unique (appointment_id);
