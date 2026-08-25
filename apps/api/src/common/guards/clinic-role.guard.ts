import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, inArray } from 'drizzle-orm';
import type { Request } from 'express';
import type { ClinicStaffRole } from '@careconnect/shared-types';
import { DRIZZLE, type Database } from '../database/database.module';
import { clinicStaff } from '../database/schema';
import { CLINIC_ROLES_KEY } from '../decorators/require-clinic-role.decorator';

/**
 * Enforces per-clinic RBAC: the caller must be `active` clinic_staff at the
 * clinic this request targets, with one of the roles the route requires.
 * Must be applied after SupabaseAuthGuard (needs request.user).
 *
 * Resolves the target clinic from `request.params.clinicId` by default. A
 * route nested under a different resource (e.g. an appointmentId) should
 * resolve and set `request.resolvedClinicId` upstream (see booking module
 * in a later milestone) before this guard runs.
 */
@Injectable()
export class ClinicRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ClinicStaffRole[]>(
      CLINIC_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { resolvedClinicId?: string }>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated user on request');
    }

    const rawClinicId = request.resolvedClinicId ?? request.params.clinicId;
    const clinicId = Array.isArray(rawClinicId) ? rawClinicId[0] : rawClinicId;
    if (!clinicId) {
      throw new ForbiddenException(
        'No clinic could be resolved for this request',
      );
    }

    const [membership] = await this.db
      .select({ role: clinicStaff.role })
      .from(clinicStaff)
      .where(
        and(
          eq(clinicStaff.clinicId, clinicId),
          eq(clinicStaff.userId, request.user.id),
          eq(clinicStaff.status, 'active'),
          inArray(clinicStaff.role, requiredRoles),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role at this clinic',
      );
    }

    return true;
  }
}
