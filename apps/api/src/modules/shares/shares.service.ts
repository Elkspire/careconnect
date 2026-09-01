import { randomBytes } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateShareInput } from '@careconnect/validation';
import type { RecordType } from '@careconnect/shared-types';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  familyMembers,
  patientRecords,
  patients,
  recordShareAccesses,
  recordShares,
} from '../../common/database/schema';
import { ClinicalService } from '../clinical/clinical.service';
import { MedicalSummaryService } from '../medical-summary/medical-summary.service';
import { VaultService } from '../vault/vault.service';

const DURATION_MS: Record<CreateShareInput['duration'], number | null> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  forever: null,
};

/**
 * "Share for a second opinion" (journeys.html, Patient · Step 07). A
 * patient-created, token-gated, read-only bundle of one subject's history
 * — no clinic module involved, this is patient-owns-the-record read
 * straight from clinical_notes/patient_records/medical_summaries, scoped
 * by the toggles the patient chose at creation, not by anything a doctor
 * configured.
 */
@Injectable()
export class SharesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly clinicalService: ClinicalService,
    private readonly medicalSummaryService: MedicalSummaryService,
    private readonly vaultService: VaultService,
  ) {}

  private async assertOwnsSubject(
    patientId: string,
    subjectType: CreateShareInput['subjectType'],
    familyMemberId?: string,
  ): Promise<void> {
    if (subjectType === 'self') return;
    const [row] = await this.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, familyMemberId!),
          eq(familyMembers.patientId, patientId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Family member not found');
    }
  }

  async create(patientId: string, input: CreateShareInput) {
    await this.assertOwnsSubject(
      patientId,
      input.subjectType,
      input.familyMemberId,
    );
    const durationMs = DURATION_MS[input.duration];
    const [row] = await this.db
      .insert(recordShares)
      .values({
        patientId,
        subjectType: input.subjectType,
        familyMemberId:
          input.subjectType === 'family_member' ? input.familyMemberId : null,
        token: randomBytes(18).toString('base64url'),
        includeClinicalHistory: input.includeClinicalHistory,
        includeLabReports: input.includeLabReports,
        includeOtherRecords: input.includeOtherRecords,
        expiresAt: durationMs ? new Date(Date.now() + durationMs) : null,
        createdBy: patientId,
      })
      .returning();
    return row;
  }

  /** Every share the patient has created for themselves or any family member, newest first, with how many times each has been opened. */
  async listMine(patientId: string) {
    const shares = await this.db
      .select({
        id: recordShares.id,
        subjectType: recordShares.subjectType,
        familyMemberId: recordShares.familyMemberId,
        familyMemberFullName: familyMembers.fullName,
        token: recordShares.token,
        includeClinicalHistory: recordShares.includeClinicalHistory,
        includeLabReports: recordShares.includeLabReports,
        includeOtherRecords: recordShares.includeOtherRecords,
        expiresAt: recordShares.expiresAt,
        revokedAt: recordShares.revokedAt,
        createdAt: recordShares.createdAt,
      })
      .from(recordShares)
      .leftJoin(
        familyMembers,
        eq(familyMembers.id, recordShares.familyMemberId),
      )
      .where(eq(recordShares.patientId, patientId))
      .orderBy(desc(recordShares.createdAt));
    if (shares.length === 0) return [];

    const accessCounts = await this.db
      .select({
        shareId: recordShareAccesses.shareId,
        count: sql<number>`count(*)::int`,
      })
      .from(recordShareAccesses)
      .where(
        inArray(
          recordShareAccesses.shareId,
          shares.map((s) => s.id),
        ),
      )
      .groupBy(recordShareAccesses.shareId);
    const countByShareId = new Map(
      accessCounts.map((a) => [a.shareId, a.count]),
    );

    return shares.map((s) => ({
      ...s,
      accessCount: countByShareId.get(s.id) ?? 0,
    }));
  }

  async revoke(patientId: string, shareId: string): Promise<void> {
    const [row] = await this.db
      .update(recordShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(recordShares.id, shareId),
          eq(recordShares.patientId, patientId),
          isNull(recordShares.revokedAt),
        ),
      )
      .returning({ id: recordShares.id });
    if (!row) {
      throw new NotFoundException('Share not found, or already revoked');
    }
  }

  /**
   * The public, unauthenticated read a doctor opens from the link. Logs
   * an access row (timestamp only — see record_share_accesses' own doc
   * comment on why there's no "who") before returning the bundle, so a
   * link that 404s below (expired/revoked) never gets logged as opened.
   */
  async getSharedBundle(token: string) {
    const [share] = await this.db
      .select()
      .from(recordShares)
      .where(eq(recordShares.token, token))
      .limit(1);
    if (!share) {
      throw new NotFoundException('This share link is invalid');
    }
    if (share.revokedAt) {
      throw new NotFoundException('This share link has been revoked');
    }
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('This share link has expired');
    }

    await this.db.insert(recordShareAccesses).values({ shareId: share.id });

    const [patient] = await this.db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, share.patientId))
      .limit(1);
    const subjectFullName =
      share.subjectType === 'family_member'
        ? (
            await this.db
              .select({ fullName: familyMembers.fullName })
              .from(familyMembers)
              .where(eq(familyMembers.id, share.familyMemberId!))
              .limit(1)
          )[0]?.fullName
        : patient?.fullName;

    const summary = await this.medicalSummaryService.get(
      share.patientId,
      share.subjectType,
      share.familyMemberId ?? undefined,
    );

    const clinicalHistory = share.includeClinicalHistory
      ? await this.clinicalService.listMyHistory(share.patientId, {
          subjectType: share.subjectType,
          familyMemberId: share.familyMemberId ?? undefined,
        })
      : [];

    const wantedRecordTypes: RecordType[] = [
      ...(share.includeLabReports ? (['lab_report'] as const) : []),
      ...(share.includeOtherRecords
        ? (['prescription_photo', 'other_document'] as const)
        : []),
    ];
    let records: Array<{
      id: string;
      recordType: string;
      fileName: string;
      createdAt: Date;
      url: string | null;
    }> = [];
    if (wantedRecordTypes.length > 0) {
      const conditions = [
        eq(patientRecords.patientId, share.patientId),
        eq(patientRecords.subjectType, share.subjectType),
        share.subjectType === 'family_member'
          ? eq(patientRecords.familyMemberId, share.familyMemberId!)
          : isNull(patientRecords.familyMemberId),
        inArray(patientRecords.recordType, wantedRecordTypes),
      ];
      const rows = await this.db
        .select({
          id: patientRecords.id,
          recordType: patientRecords.recordType,
          fileName: patientRecords.fileName,
          createdAt: patientRecords.createdAt,
        })
        .from(patientRecords)
        .where(and(...conditions))
        .orderBy(desc(patientRecords.createdAt));
      records = await Promise.all(
        rows.map(async (r) => {
          const signed = await this.vaultService
            .getSignedUrlForRecordUnchecked(r.id)
            .catch(() => null);
          return { ...r, url: signed?.url ?? null };
        }),
      );
    }

    return {
      subjectFullName: subjectFullName ?? null,
      scope: {
        includeClinicalHistory: share.includeClinicalHistory,
        includeLabReports: share.includeLabReports,
        includeOtherRecords: share.includeOtherRecords,
      },
      expiresAt: share.expiresAt,
      medicalSummary: summary,
      clinicalHistory,
      records,
    };
  }
}
