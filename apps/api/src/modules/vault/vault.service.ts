import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ListVaultRecordsQuery,
  UploadVaultRecordInput,
} from '@careconnect/validation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { patientRecords } from '../../common/database/schema';
import { SUPABASE_STORAGE } from '../../common/storage/storage.module';

const BUCKET = 'patient-records';
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
]);
const SIGNED_URL_TTL_SECONDS = 300;

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/** fileName/mimeType come from the uploaded file itself, not the request body — see VaultController.upload. */
export type UploadRecordMetadata = Omit<
  UploadVaultRecordInput,
  'fileName' | 'mimeType'
>;

@Injectable()
export class VaultService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SUPABASE_STORAGE) private readonly storage: SupabaseClient,
  ) {}

  async uploadRecord(
    patientId: string,
    input: UploadRecordMetadata,
    file: UploadedFile,
  ) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    // {patient_id}/{record_id}/{file_name} — matches the storage RLS policy
    // convention in 0001_init.sql (first path segment = owner's own id).
    const recordId = crypto.randomUUID();
    const path = `${patientId}/${recordId}/${encodeURIComponent(file.originalname)}`;

    const { error: uploadError } = await this.storage.storage
      .from(BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const [row] = await this.db
      .insert(patientRecords)
      .values({
        id: recordId,
        patientId,
        subjectType: input.subjectType,
        familyMemberId:
          input.subjectType === 'family_member' ? input.familyMemberId : null,
        recordType: input.recordType,
        source: 'patient_upload',
        filePath: path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        linkedAppointmentId: input.linkedAppointmentId,
        uploadedBy: patientId,
      })
      .returning();
    return row;
  }

  listRecords(patientId: string, query: ListVaultRecordsQuery) {
    const conditions = [eq(patientRecords.patientId, patientId)];
    if (query.subjectType)
      conditions.push(eq(patientRecords.subjectType, query.subjectType));
    if (query.familyMemberId)
      conditions.push(eq(patientRecords.familyMemberId, query.familyMemberId));
    if (query.recordType)
      conditions.push(eq(patientRecords.recordType, query.recordType));

    return this.db
      .select()
      .from(patientRecords)
      .where(and(...conditions));
  }

  /** Also the audit "view" checkpoint — see VaultController's @Audit('view', ...). */
  async getSignedUrl(
    patientId: string,
    recordId: string,
  ): Promise<{ url: string }> {
    const [row] = await this.db
      .select({
        filePath: patientRecords.filePath,
        patientId: patientRecords.patientId,
      })
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.id, recordId),
          eq(patientRecords.patientId, patientId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Record not found');
    }

    const { data, error } = await this.storage.storage
      .from(BUCKET)
      .createSignedUrl(row.filePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      throw new NotFoundException(
        'Could not generate a signed URL for this record',
      );
    }
    return { url: data.signedUrl };
  }

  async deleteRecord(patientId: string, recordId: string): Promise<void> {
    const [row] = await this.db
      .select({ filePath: patientRecords.filePath })
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.id, recordId),
          eq(patientRecords.patientId, patientId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Record not found');
    }

    await this.storage.storage.from(BUCKET).remove([row.filePath]);
    await this.db
      .delete(patientRecords)
      .where(
        and(
          eq(patientRecords.id, recordId),
          eq(patientRecords.patientId, patientId),
        ),
      );
  }
}
