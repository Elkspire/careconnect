-- Adds the "cancellation window the clinic sets" from the product doc's
-- booking feature (3.2), missing from 0001_init.sql. Additive migration —
-- 0001 already shipped conceptually, don't edit it in place.

alter table practitioner_clinic
  add column cancellation_window_hours integer not null default 24;
