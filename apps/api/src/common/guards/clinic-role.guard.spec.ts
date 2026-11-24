import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/pg-proxy';
import type { ClinicStaffRole } from '@careconnect/shared-types';
import type { Database } from '../database/database.module';
import {
  RequireClinicRole,
  RequireStaffPermission,
} from '../decorators/require-clinic-role.decorator';
import { ClinicRoleGuard } from './clinic-role.guard';

class Routes {
  open() {}

  @RequireClinicRole('owner', 'receptionist')
  byRole() {}

  @RequireClinicRole('owner', 'receptionist')
  @RequireStaffPermission('viewPatientList')
  byPermission() {}
}

@RequireClinicRole('owner')
@RequireStaffPermission('clinicalNotes')
class ClassLevelRoutes {
  inherits() {}

  @RequireClinicRole('receptionist')
  overrides() {}
}

const USER = { id: 'user-1' };
type Membership = { role: ClinicStaffRole; revokedPermissions: string[] };

/**
 * Drizzle builds the guard's real SQL; only the round trip is replaced, so
 * the filters the query sends can be asserted on.
 */
function setup(membership?: Membership) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db = drizzle((sql, params) => {
    queries.push({ sql, params });
    return Promise.resolve({
      rows: membership
        ? [[membership.role, `{${membership.revokedPermissions.join(',')}}`]]
        : [],
    });
  });
  const guard = new ClinicRoleGuard(new Reflector(), db as unknown as Database);

  const check = (
    controller: typeof Routes | typeof ClassLevelRoutes,
    method: string,
    request: object = {},
  ) =>
    guard.canActivate({
      getHandler: () =>
        (controller.prototype as unknown as Record<string, unknown>)[method],
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          user: USER,
          params: { clinicId: 'clinic-a' },
          ...request,
        }),
      }),
    } as unknown as ExecutionContext);

  return { check, queries };
}

const staff = (
  role: ClinicStaffRole,
  ...revokedPermissions: string[]
): Membership => ({ role, revokedPermissions });

describe('ClinicRoleGuard', () => {
  it('lets routes with no clinic role through without a query', async () => {
    const { check, queries } = setup();
    await expect(check(Routes, 'open', { user: undefined })).resolves.toBe(
      true,
    );
    expect(queries).toEqual([]);
  });

  it('refuses an unauthenticated request', async () => {
    const { check, queries } = setup(staff('owner'));
    await expect(
      check(Routes, 'byRole', { user: undefined }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queries).toEqual([]);
  });

  it('refuses when no clinic can be resolved', async () => {
    const { check, queries } = setup(staff('owner'));
    await expect(
      check(Routes, 'byRole', { params: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(queries).toEqual([]);
  });

  it('refuses someone with no matching membership', async () => {
    const { check } = setup();
    await expect(check(Routes, 'byRole')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a member with a required role', async () => {
    const { check } = setup(staff('receptionist'));
    await expect(check(Routes, 'byRole')).resolves.toBe(true);
  });

  it('only accepts an active membership of this user at this clinic in a required role', async () => {
    const { check, queries } = setup(staff('owner'));
    await check(Routes, 'byRole');

    expect(queries).toHaveLength(1);
    const { sql, params } = queries[0]!;
    const where = sql.slice(sql.indexOf(' where '));
    expect(where).toContain('"clinic_staff"."clinic_id" = $1');
    expect(where).toContain('"clinic_staff"."user_id" = $2');
    expect(where).toContain('"clinic_staff"."status" = $3');
    expect(where).toContain('"clinic_staff"."role" in ($4, $5)');
    expect(where).not.toContain(' or ');
    expect(params.slice(0, 5)).toEqual([
      'clinic-a',
      USER.id,
      'active',
      'owner',
      'receptionist',
    ]);
  });

  it('uses the clinic resolved upstream over the one in the URL', async () => {
    const { check, queries } = setup(staff('owner'));
    await check(Routes, 'byRole', { resolvedClinicId: 'clinic-b' });
    expect(queries[0]!.params[0]).toBe('clinic-b');
  });

  describe('permission overrides', () => {
    it('refuses staff whose permission was revoked', async () => {
      const { check } = setup(staff('receptionist', 'viewPatientList'));
      await expect(check(Routes, 'byPermission')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('ignores other revoked permissions', async () => {
      const { check } = setup(staff('receptionist', 'checkInPatients'));
      await expect(check(Routes, 'byPermission')).resolves.toBe(true);
    });

    it('never narrows an owner', async () => {
      const { check } = setup(staff('owner', 'viewPatientList'));
      await expect(check(Routes, 'byPermission')).resolves.toBe(true);
    });

    it('does not apply to routes that need no permission', async () => {
      const { check } = setup(staff('receptionist', 'viewPatientList'));
      await expect(check(Routes, 'byRole')).resolves.toBe(true);
    });
  });

  describe('class-level rules', () => {
    it('apply to every handler', async () => {
      const { check, queries } = setup(staff('junior_doctor', 'clinicalNotes'));
      await expect(check(ClassLevelRoutes, 'inherits')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(queries[0]!.params[3]).toBe('owner');
    });

    it('give way to a role set on the handler', async () => {
      const { check, queries } = setup(staff('receptionist'));
      await check(ClassLevelRoutes, 'overrides');
      expect(queries[0]!.params[3]).toBe('receptionist');
    });
  });
});
