-- Lets a doctor narrow (never widen) what a specific receptionist/junior
-- doctor can do, below their role's default ceiling (see
-- packages/shared-types' ROLE_PERMISSION_CEILING) — e.g. a receptionist
-- who shouldn't be able to check patients in. Each entry is a permission
-- key explicitly revoked for this staff member; absence means the role's
-- default applies. ClinicRoleGuard is the actual enforcement (see
-- RequireStaffPermission) — this column only feeds that check.
alter table clinic_staff
  add column revoked_permissions text[] not null default '{}';

alter table clinic_staff
  add constraint clinic_staff_revoked_permissions_valid check (
    revoked_permissions <@ array[
      'viewPatientList', 'viewTodayQueue', 'checkInPatients',
      'viewRecords', 'clinicalNotes', 'manageStaff', 'manageFeesSchedule'
    ]::text[]
  );

-- The owner's access is never overridable — only invited staff go through
-- ClinicRoleGuard's permission-revocation check to begin with, but this
-- keeps the row itself from ever claiming otherwise.
alter table clinic_staff
  add constraint clinic_staff_owner_no_overrides check (
    role != 'owner' or revoked_permissions = '{}'
  );
