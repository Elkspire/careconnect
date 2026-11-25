import { Inject, Injectable } from '@nestjs/common';
import type { AuditAction } from '@careconnect/shared-types';
import { desc, eq, type SQL, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  auditLog,
  patientRecords,
} from '../../common/database/schema';

export interface AuditEntry {
  actorUserId: string;
  actorRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  clinicId?: string;
  patientId?: string;
  /** Where to find the patient, for a route that only names one of these. */
  patientOf?: { appointmentId: string } | { recordId: string };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      clinicId: entry.clinicId,
      patientId: entry.patientId ?? this.patientOf(entry.patientOf),
      metadata: entry.metadata ?? {},
    });
  }

  private patientOf(target: AuditEntry['patientOf']): SQL | undefined {
    if (!target) {
      return undefined;
    }
    return 'recordId' in target
      ? sql`(select ${patientRecords.patientId} from ${patientRecords} where ${patientRecords.id} = ${target.recordId})`
      : sql`(select ${appointments.patientId} from ${appointments} where ${appointments.id} = ${target.appointmentId})`;
  }

  /** Owner-facing read endpoint per the Phase 1 plan's AuditModule notes. */
  listForActor(actorUserId: string) {
    return this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.actorUserId, actorUserId))
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
  }
}
