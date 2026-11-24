import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod, type Type } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  type ClinicStaffRole,
  ROLE_PERMISSION_CEILING,
  type StaffPermissionKey,
} from '@careconnect/shared-types';
import {
  CLINIC_PERMISSION_KEY,
  CLINIC_ROLES_KEY,
} from '../decorators/require-clinic-role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AdminGuard } from './admin.guard';

/**
 * Who may call what, read straight off the controllers. Adding a route, or
 * changing who can reach one, has to change the tables below as well. The
 * controllers are found on disk, so a new one can't be missed.
 */

interface Route {
  name: string;
  isPublic: boolean;
  isAdmin: boolean;
  roles: ClinicStaffRole[];
  permission?: StaffPermissionKey;
}

const SRC = join(__dirname, '../..');

function loadControllers(): Type[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.controller.ts'))
    .flatMap((file) =>
      Object.values(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(join(SRC, file)) as Record<string, unknown>,
      ),
    )
    .filter(
      (value): value is Type =>
        typeof value === 'function' &&
        Reflect.hasMetadata(PATH_METADATA, value),
    );
}

function routesOf(controller: Type): Route[] {
  const reflector = new Reflector();
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .map((key) => prototype[key])
    .filter(
      (handler): handler is () => unknown =>
        typeof handler === 'function' &&
        Reflect.hasMetadata(METHOD_METADATA, handler),
    )
    .map((handler) => {
      const own = <T>(key: string) =>
        reflector.getAllAndOverride<T | undefined>(key, [handler, controller]);
      const guards = [controller, handler].flatMap(
        (target) =>
          (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[]) ?? [],
      );
      const method = Reflect.getMetadata(
        METHOD_METADATA,
        handler,
      ) as RequestMethod;
      const path = [controller, handler]
        .map((target) => Reflect.getMetadata(PATH_METADATA, target) as string)
        .flatMap((part) => part.split('/'))
        .filter(Boolean)
        .join('/');
      return {
        name: `${RequestMethod[method]} /${path}`,
        isPublic: own<boolean>(IS_PUBLIC_KEY) ?? false,
        isAdmin: guards.includes(AdminGuard),
        roles: own<ClinicStaffRole[]>(CLINIC_ROLES_KEY) ?? [],
        permission: own<StaffPermissionKey>(CLINIC_PERMISSION_KEY),
      };
    });
}

const routes = loadControllers().flatMap(routesOf);
const names = (matching: Route[]) => matching.map((r) => r.name).sort();

const PUBLIC_ROUTES = [
  'GET /auth/check-role',
  'GET /booking/availability',
  'GET /directory/practitioners',
  'GET /directory/practitioners/:slug',
  'GET /directory/specialties',
  'GET /health',
  'GET /notifications/push/vapid-public-key',
  'GET /practitioners/:practitionerId/reviews',
  'GET /shares/view/:token',
];

const OWNER = 'owner';
const CLINICAL = 'junior_doctor owner';
const DESK = 'owner receptionist';
const ANY_STAFF = 'junior_doctor owner receptionist';

const C = '/clinics/:clinicId';
const PATIENT = `${C}/patients/:patientId`;
const FAMILY = `${PATIENT}/family/:familyMemberId`;
const VITALS = `${C}/appointments/:appointmentId/vitals`;
const NOTE = `${C}/clinical-notes/:appointmentId`;

/** Route -> [roles allowed, staff permission an owner can revoke]. */
const CLINIC_ROUTES: Record<string, [string, StaffPermissionKey?]> = {
  [`GET ${C}/practitioner-config`]: [OWNER],
  [`PUT ${C}/practitioner-config`]: [OWNER],
  [`POST ${C}/leave`]: [OWNER],
  [`GET ${C}/staff`]: [OWNER],
  [`POST ${C}/staff`]: [OWNER],
  [`DELETE ${C}/staff/:staffId`]: [OWNER],
  [`GET ${C}/analytics`]: [OWNER],
  [`GET ${C}/patient-assignments`]: [OWNER],
  [`POST ${C}/patient-assignments`]: [OWNER],
  [`DELETE ${C}/patient-assignments/:assignmentId`]: [OWNER],

  [`GET ${C}/today`]: [ANY_STAFF, 'viewTodayQueue'],
  [`GET ${C}/waitlist`]: [ANY_STAFF, 'viewTodayQueue'],
  [`POST ${C}/check-in`]: [DESK, 'checkInPatients'],

  [`GET ${C}/patients`]: [ANY_STAFF, 'viewPatientList'],
  [`GET ${PATIENT}`]: [ANY_STAFF, 'viewPatientList'],
  [`GET ${FAMILY}`]: [ANY_STAFF, 'viewPatientList'],

  [`GET ${PATIENT}/records`]: [CLINICAL, 'viewRecords'],
  [`GET ${FAMILY}/records`]: [CLINICAL, 'viewRecords'],
  [`GET ${C}/records/:recordId/signed-url`]: [CLINICAL, 'viewRecords'],
  [`GET ${PATIENT}/medical-summary`]: [CLINICAL, 'viewRecords'],
  [`PUT ${PATIENT}/medical-summary`]: [CLINICAL, 'clinicalNotes'],
  [`GET ${FAMILY}/medical-summary`]: [CLINICAL, 'viewRecords'],
  [`PUT ${FAMILY}/medical-summary`]: [CLINICAL, 'clinicalNotes'],

  [`GET ${VITALS}`]: [CLINICAL, 'recordVitals'],
  [`PUT ${VITALS}`]: [CLINICAL, 'recordVitals'],
  [`GET ${C}/appointments/recent`]: [CLINICAL, 'attachRecords'],
  [`POST ${C}/records`]: [CLINICAL, 'attachRecords'],

  [`POST ${C}/clinical-notes`]: [CLINICAL, 'clinicalNotes'],
  [`GET ${NOTE}`]: [CLINICAL, 'clinicalNotes'],
  [`PATCH ${NOTE}`]: [CLINICAL, 'clinicalNotes'],
  [`GET ${NOTE}/allergies`]: [CLINICAL, 'clinicalNotes'],
  [`GET ${NOTE}/prescription`]: [CLINICAL, 'clinicalNotes'],
  [`POST ${NOTE}/prescription`]: [CLINICAL, 'clinicalNotes'],
};

describe('Route permissions', () => {
  it('only these routes work without signing in', () => {
    expect(names(routes.filter((r) => r.isPublic))).toEqual(PUBLIC_ROUTES);
  });

  it('only these clinic routes exist', () => {
    expect(names(routes.filter((r) => r.name.includes(':clinicId')))).toEqual(
      Object.keys(CLINIC_ROUTES).sort(),
    );
  });

  it.each(Object.entries(CLINIC_ROUTES))(
    '%s is limited to the right staff',
    (name, [roles, permission]) => {
      const route = routes.find((r) => r.name === name)!;
      expect(route.isPublic).toBe(false);
      expect([...route.roles].sort().join(' ')).toBe(roles);
      expect(route.permission).toBe(permission);
    },
  );

  it('never requires a role where there is no clinic to check it against', () => {
    expect(
      names(
        routes.filter(
          (r) => r.roles.length > 0 && !r.name.includes(':clinicId'),
        ),
      ),
    ).toEqual([]);
  });

  // Otherwise the owner's Staff page could not switch it off, and the route
  // would hand a role something outside its ceiling.
  it.each(['receptionist', 'junior_doctor'] as const)(
    '%s can only reach routes inside its permission ceiling',
    (role) => {
      const reachable = routes.filter((r) => r.roles.includes(role));
      expect(reachable).not.toEqual([]);
      for (const route of reachable) {
        expect(ROLE_PERMISSION_CEILING[role]).toContain(route.permission);
      }
    },
  );

  it('keeps receptionists away from everything clinical', () => {
    const clinical: StaffPermissionKey[] = [
      'viewRecords',
      'clinicalNotes',
      'recordVitals',
      'attachRecords',
    ];
    expect(
      names(
        routes.filter(
          (r) =>
            r.roles.includes('receptionist') &&
            (!r.permission || clinical.includes(r.permission)),
        ),
      ),
    ).toEqual([]);
  });

  it('every /admin route, and nothing else, is behind AdminGuard', () => {
    const admin = routes.filter((r) => r.name.includes(' /admin'));
    expect(admin).not.toEqual([]);
    expect(names(routes.filter((r) => r.isAdmin))).toEqual(names(admin));
    expect(names(admin.filter((r) => r.isPublic))).toEqual([]);
  });
});
