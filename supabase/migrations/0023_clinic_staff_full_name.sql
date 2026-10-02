-- Receptionist/assistant invites have no practitioners row to resolve a
-- display name from (see ClinicService.listStaff's left join to
-- practitioners) — the fullName already collected on the invite form was
-- validated but never persisted, so the staff list fell back to showing a
-- phone number or email instead of a name for those roles. Owner/
-- junior_doctor still resolve from practitioners.full_name (their real
-- registered name); this column only matters when no practitioner profile
-- exists to ask instead.
alter table clinic_staff
  add column full_name text;
