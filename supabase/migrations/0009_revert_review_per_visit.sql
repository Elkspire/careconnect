-- Revert 0008_review_per_visit.sql — one review per patient per practitioner
-- again (a resubmission updates that review) rather than one per visit;
-- keeps the average rating meaningful instead of one enthusiastic repeat
-- visitor outweighing everyone else's single review.

-- Collapse any per-visit duplicates down to each patient's most recent
-- review per practitioner before restoring the uniqueness constraint.
delete from practitioner_reviews a
using practitioner_reviews b
where a.practitioner_id = b.practitioner_id
  and a.patient_id = b.patient_id
  and a.created_at < b.created_at;

alter table practitioner_reviews
  drop constraint practitioner_reviews_appointment_id_key;

alter table practitioner_reviews
  drop column appointment_id;

alter table practitioner_reviews
  add constraint practitioner_reviews_practitioner_id_patient_id_key
  unique (practitioner_id, patient_id);
