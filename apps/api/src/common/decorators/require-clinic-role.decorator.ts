import { SetMetadata } from '@nestjs/common';
import type { ClinicStaffRole } from '@careconnect/shared-types';

export const CLINIC_ROLES_KEY = 'clinicRoles';

/**
 * Marks a route as requiring the caller to be active clinic_staff at the
 * clinic resolved for this request (see ClinicRoleGuard), with one of the
 * given roles. Clinical endpoints must only ever specify 'owner' — see
 * modules/clinical, which mirrors the clinical_notes RLS policy that never
 * references clinic_staff at all.
 */
export const RequireClinicRole = (...roles: ClinicStaffRole[]) =>
  SetMetadata(CLINIC_ROLES_KEY, roles);
