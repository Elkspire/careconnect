import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../../modules/audit/audit.service';
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator';
import type { AuthenticatedUser } from '../guards/supabase-auth.guard';

/**
 * Wraps ClinicalModule and VaultModule handlers (see @Audit()). Writes
 * after a successful response, capturing *how* the resource was reached
 * (route params), not just that it was — see the Phase 1 plan's rationale
 * for why this is app-layer rather than a DB trigger.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!meta) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const actorUserId = request.user?.id;

    return next.handle().pipe(
      tap((result: unknown) => {
        if (!actorUserId) {
          return;
        }
        const resultRecord =
          result && typeof result === 'object'
            ? (result as Record<string, unknown>)
            : {};
        const param = (name: string): string | undefined => {
          const value = request.params[name];
          return Array.isArray(value) ? value[0] : value;
        };
        const resourceId =
          param('appointmentId') ??
          param('id') ??
          (typeof resultRecord.id === 'string' ? resultRecord.id : undefined);
        const patientId =
          typeof resultRecord.patientId === 'string'
            ? resultRecord.patientId
            : undefined;

        void this.auditLogService.record({
          actorUserId,
          actorRole: meta.actorRole,
          action: meta.action,
          resourceType: meta.resourceType,
          resourceId,
          clinicId: param('clinicId'),
          patientId,
        });
      }),
    );
  }
}
