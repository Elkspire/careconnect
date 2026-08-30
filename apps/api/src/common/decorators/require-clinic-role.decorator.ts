import { SetMetadata } from '@nestjs/common';
import type {
  ClinicStaffRole,
  StaffPermissionKey,
} from '@careconnect/shared-types';

export const CLINIC_ROLES_KEY = 'clinicRoles';
export const CLINIC_PERMISSION_KEY = 'clinicPermission';

/**
 * Marks a route as requiring the caller to be active clinic_staff at the
 * clinic resolved for this request (see ClinicRoleGuard), with one of the
 * given roles. Clinical endpoints must only ever specify 'owner' — see
 * modules/clinical, which mirrors the clinical_notes RLS policy that never
 * references clinic_staff at all.
 */
export const RequireClinicRole = (...roles: ClinicStaffRole[]) =>
  SetMetadata(CLINIC_ROLES_KEY, roles);

/**
 * Narrows RequireClinicRole further: even a caller whose role is in the
 * required list is rejected if a doctor has explicitly revoked this
 * permission for them (clinic_staff.revoked_permissions — see
 * ROLE_PERMISSION_CEILING and the Staff page's invite-time toggles).
 * Owner is always exempt. Routes that are already owner-only don't need
 * this — there's nothing to narrow when only the owner can pass.
 */
export const RequireStaffPermission = (permission: StaffPermissionKey) =>
  SetMetadata(CLINIC_PERMISSION_KEY, permission);
