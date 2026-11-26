import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pg-proxy';
import type { Database } from '../../common/database/database.module';
import type { MedicalSummaryService } from '../medical-summary/medical-summary.service';
import type { VaultService } from '../vault/vault.service';
import { appointments } from '../../common/database/schema';
import { ClinicService } from './clinic.service';

/** Drizzle builds the service's real SQL; only the round trip is scripted. */
function setup(
  caller: 'owner' | 'junior_doctor' | 'nobody',
  emitAsync = jest.fn(() => Promise.resolve()),
) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db = drizzle((sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('select') && sql.includes('"auth"."users" where')) {
      return Promise.resolve({ rows: [['user-1']] });
    }
    const asksAboutCaller =
      sql.startsWith('select "id" from "clinic_staff"') &&
      params.includes(caller);
    return Promise.resolve({ rows: asksAboutCaller ? [['staff-row']] : [] });
  });
  const service = new ClinicService(
    db as unknown as Database,
    {} as SupabaseClient,
    { emitAsync } as unknown as EventEmitter2,
    {} as VaultService,
    {} as MedicalSummaryService,
  );
  return { service, queries };
}

describe('ClinicService', () => {
  it('checking in waits for the notification to be sent', async () => {
    const db = drizzle((sql) =>
      Promise.resolve({
        rows: sql.startsWith('update')
          ? [Object.keys(getTableColumns(appointments)).map(() => null)]
          : [['appointment-1', 'clinic-1', 'booked']],
      }),
    );
    let finish = () => {};
    const sending = new Promise<void>((resolve) => (finish = resolve));
    const emitAsync = jest.fn(() => sending);
    const service = new ClinicService(
      db as unknown as Database,
      {} as SupabaseClient,
      { emitAsync } as unknown as EventEmitter2,
      {} as VaultService,
      {} as MedicalSummaryService,
    );
    let done = false;
    const request = service
      .checkIn('clinic-1', { appointmentId: 'appointment-1' })
      .then(() => (done = true));

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(emitAsync).toHaveBeenCalledWith(
      'patient.checked_in',
      expect.anything(),
    );
    expect(done).toBe(false);

    finish();
    await request;
  });

  describe.each([
    ['listToday', 'appointments'],
    ['listClinicWaitlist', 'waitlist_entries'],
    ['listAppointmentsForAttach', 'appointments'],
  ] as const)('%s', (method, table) => {
    const listSql = async (caller: 'owner' | 'junior_doctor') => {
      const { service, queries } = setup(caller);
      await service[method]('clinic-1', 'caller-1');
      return queries.find((q) => q.sql.includes(`from "${table}"`))!;
    };

    it('shows a junior doctor only patients assigned to them', async () => {
      const { sql, params } = await listSql('junior_doctor');
      expect(sql).toContain('exists (select');
      expect(sql).toContain(
        `"patient_assignments"."patient_id" = "${table}"."patient_id"`,
      );
      expect(sql).toContain(
        `"patient_assignments"."family_member_id" is not distinct from "${table}"."family_member_id"`,
      );
      expect(params).toContain('caller-1');
      expect(params.filter((p) => p === 'clinic-1')).toHaveLength(2);
    });

    it('does not narrow anyone else', async () => {
      const { sql } = await listSql('owner');
      expect(sql).not.toContain('patient_assignments');
    });
  });

  describe('inviting and removing staff', () => {
    const invitation = {
      clinicId: 'clinic-1',
      phone: '+923001234567',
      fullName: 'Someone',
      role: 'receptionist' as const,
      deniedPermissions: [],
    };
    const inserts = (queries: Array<{ sql: string }>) =>
      queries.filter((q) => q.sql.startsWith('insert into "clinic_staff"'));

    it('an invitation waits for its message to be sent', async () => {
      let finish = () => {};
      const sending = new Promise<void>((resolve) => (finish = resolve));
      const emitAsync = jest.fn(() => sending);
      const { service } = setup('nobody', emitAsync);
      let done = false;
      const request = service
        .inviteStaff('clinic-1', 'user-1', invitation)
        .then(() => (done = true));

      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(emitAsync).toHaveBeenCalledWith(
        'staff.invited',
        expect.anything(),
      );
      expect(done).toBe(false);

      finish();
      await request;
    });

    it('the owner cannot lock themself out by inviting their own number', async () => {
      const { service, queries } = setup('owner');
      await expect(
        service.inviteStaff('clinic-1', 'user-1', invitation),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(inserts(queries)).toEqual([]);
    });

    it('anyone else can be invited', async () => {
      const { service, queries } = setup('nobody');
      await service.inviteStaff('clinic-1', 'user-1', invitation);
      expect(inserts(queries)).toHaveLength(1);
    });

    it('the owner cannot lock themself out by removing their own membership', async () => {
      const { service, queries } = setup('owner');
      await expect(
        service.revokeStaff('clinic-1', 'staff-row'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(queries[0]!.sql).toContain('"clinic_staff"."role" <> ');
      expect(queries[0]!.params).toContain('owner');
    });
  });
});
