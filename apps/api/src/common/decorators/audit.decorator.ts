import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@careconnect/shared-types';

export const AUDIT_KEY = 'auditMeta';

export interface AuditMeta {
  action: AuditAction;
  resourceType: string;
  /** The role the caller is necessarily acting as on this route (route is already role-gated). */
  actorRole: string;
}

/** Marks a route for AuditLogInterceptor — see modules/clinical and modules/vault. */
export const Audit = (
  action: AuditAction,
  resourceType: string,
  actorRole: string,
) =>
  SetMetadata(AUDIT_KEY, {
    action,
    resourceType,
    actorRole,
  } satisfies AuditMeta);
