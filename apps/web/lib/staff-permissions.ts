/**
 * Thin re-export of the shared permission vocabulary so the Staff page's
 * components have one import to reach for. The actual data — and the
 * server-side enforcement it mirrors — lives in packages/shared-types
 * (ROLE_PERMISSION_CEILING) and apps/api's ClinicRoleGuard.
 */
import {
  ROLE_PERMISSION_CEILING,
  STAFF_PERMISSION_KEY,
  type AssignableStaffRole,
  type StaffPermissionKey,
} from "@careconnect/shared-types";

export const STAFF_PERMISSION_KEYS = STAFF_PERMISSION_KEY;
export type { AssignableStaffRole, StaffPermissionKey };

export function isPermissionGranted(role: AssignableStaffRole, key: StaffPermissionKey): boolean {
  return ROLE_PERMISSION_CEILING[role].includes(key);
}
