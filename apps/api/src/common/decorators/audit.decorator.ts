import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@careconnect/shared-types';

export const AUDIT_KEY = 'auditMeta';

export interface AuditMeta {
  action: AuditAction;
  resourceType: string;
  /**
   * Who the caller is on a route with no clinic role. On a clinic route it is
   * the membership ClinicRoleGuard let in: owner and junior_doctor share them.
   */
  actorRole?: string;
  /**
   * Parts of a saved change's result the caller gets even when the audit entry
   * can't be saved: safety warnings about what they just did. Never set it on
   * a view, which returns nothing unrecorded.
   */
  alwaysReturn?: string[];
}

/** Marks a route for AuditLogInterceptor — see modules/clinic, clinical and vault. */
export const Audit = (
  action: AuditAction,
  resourceType: string,
  actorRole?: string,
  alwaysReturn?: string[],
) =>
  SetMetadata(AUDIT_KEY, {
    action,
    resourceType,
    actorRole,
    alwaysReturn,
  } satisfies AuditMeta);
