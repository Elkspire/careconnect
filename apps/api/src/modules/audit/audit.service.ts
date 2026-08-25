import { Inject, Injectable } from '@nestjs/common';
import type { AuditAction } from '@careconnect/shared-types';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { auditLog } from '../../common/database/schema';

export interface AuditEntry {
  actorUserId: string;
  actorRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  clinicId?: string;
  patientId?: string;
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
      patientId: entry.patientId,
      metadata: entry.metadata ?? {},
    });
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
