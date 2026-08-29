-- Adds the junior_doctor clinic staff role (product doc section 3.5,
-- deferred from v1 to v2 — now being pulled forward). A junior doctor can
-- view patient histories and write/co-author clinical notes at the clinics
-- they're staff of, but cannot manage staff, fees, or the schedule — that
-- stays owner-only. Receptionist is unaffected: still no clinical access.
alter type clinic_staff_role add value 'junior_doctor';
