import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Database } from '../database/database.module';
import { platformAdmins } from '../database/schema';

/**
 * Applied to the whole AdminController — the caller must be a row in
 * platform_admins (see 0014_admin_verification.sql), a platform-operator
 * allowlist with no self-serve join path. Not a clinic_staff role or a
 * flag on patients/practitioners: an admin isn't scoped to any one clinic.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated user on request');
    }

    const [row] = await this.db
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(eq(platformAdmins.id, request.user.id))
      .limit(1);
    if (!row) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
