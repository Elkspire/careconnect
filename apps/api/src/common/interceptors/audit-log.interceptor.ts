import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuditFailure } from '@careconnect/shared-types';
import type { Request } from 'express';
import { concatMap, Observable } from 'rxjs';
import {
  type AuditEntry,
  AuditLogService,
} from '../../modules/audit/audit.service';
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator';
import type { AuthenticatedUser } from '../guards/supabase-auth.guard';

/** The web app shows its own translated message, picked by `code`. */
const failure = (statusCode: number, code: AuditFailure, message: string) => ({
  statusCode,
  code,
  message,
});

/**
 * Wraps every handler that reads or changes medical data (see @Audit(); the
 * full list is in route-permissions.spec.ts). Writes once
 * the handler has succeeded and before the response is sent, capturing *how*
 * the resource was reached (route params), not just that it was — see the
 * Phase 1 plan's rationale for why this is app-layer rather than a DB trigger.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

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
      .getRequest<
        Request & { user?: AuthenticatedUser; clinicRole?: string }
      >();
    const actorUserId = request.user?.id;

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        if (!actorUserId) {
          return result;
        }
        const resultRecord =
          result && typeof result === 'object'
            ? (result as Record<string, unknown>)
            : {};
        const param = (name: string): string | undefined => {
          const value = request.params[name];
          return Array.isArray(value) ? value[0] : value;
        };
        const returned = (name: string): string | undefined => {
          const value = resultRecord[name];
          return typeof value === 'string' ? value : undefined;
        };
        const appointmentId = param('appointmentId');
        const recordId = param('recordId');
        const familyMemberId =
          param('familyMemberId') ?? returned('familyMemberId');
        const actorRole = request.clinicRole ?? meta.actorRole ?? 'unknown';

        const entry: AuditEntry = {
          actorUserId,
          actorRole,
          action: meta.action,
          resourceType: meta.resourceType,
          resourceId:
            appointmentId ?? recordId ?? param('id') ?? returned('id'),
          clinicId: param('clinicId'),
          patientId:
            param('patientId') ??
            returned('patientId') ??
            (actorRole === 'patient' ? actorUserId : undefined),
          patientOf: appointmentId
            ? { appointmentId }
            : recordId
              ? { recordId }
              : undefined,
          metadata: familyMemberId ? { familyMemberId } : undefined,
        };
        // Awaited: Vercel can freeze the function once the response is sent.
        // No entry, no access: a view is refused. The handler has already run
        // by now, so a change can't be refused — it fails all the same, but
        // says it was saved so nobody repeats it. The entry itself is logged.
        try {
          await this.auditLogService.record(entry);
        } catch (err) {
          const error = err as Error;
          this.logger.error(
            `Audit entry not saved: ${JSON.stringify(entry)}: ${error.message}`,
            error.stack,
          );
          throw meta.action === 'view'
            ? new ServiceUnavailableException(
                failure(
                  503,
                  'audit_view_refused',
                  'This access could not be recorded, so it was refused. Please try again.',
                ),
                { cause: err },
              )
            : new InternalServerErrorException(
                {
                  ...failure(
                    500,
                    'audit_change_saved',
                    'Your change was saved but could not be recorded in the audit log. Reload before trying again.',
                  ),
                  ...Object.fromEntries(
                    (meta.alwaysReturn ?? []).map((key) => [
                      key,
                      resultRecord[key],
                    ]),
                  ),
                },
                { cause: err },
              );
        }
        return result;
      }),
    );
  }
}
