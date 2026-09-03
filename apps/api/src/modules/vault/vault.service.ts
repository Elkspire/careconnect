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
import { appointments, patientRecords } from '../../common/database/schema';
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

    // Linking a record to an appointment is what makes it visible to that
    // appointment's clinic (see ClinicService.getPatientRecords) — verify
    // the appointment actually belongs to this patient/subject so nobody
    // can share a record into a visit that isn't theirs.
    if (input.linkedAppointmentId) {
      const [appointment] = await this.db
        .select({
          patientId: appointments.patientId,
          subjectType: appointments.subjectType,
          familyMemberId: appointments.familyMemberId,
        })
        .from(appointments)
        .where(eq(appointments.id, input.linkedAppointmentId))
        .limit(1);
      const matchesSubject =
        appointment &&
        appointment.patientId === patientId &&
        appointment.subjectType === input.subjectType &&
        appointment.familyMemberId ===
          (input.subjectType === 'family_member' ? input.familyMemberId : null);
      if (!matchesSubject) {
        throw new BadRequestException(
          'linkedAppointmentId does not match one of your own appointments',
        );
      }
    }

    const { recordId, path } = await this.storeFile(patientId, file);

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

  /**
   * {patient_id}/{record_id}/{safe_file_name} — matches the storage RLS
   * policy convention in 0001_init.sql (first path segment = the owning
   * patient's own id, even when a clinic staff member is the one
   * uploading via attachRecord below). The storage key deliberately does
   * NOT carry the user's original filename verbatim (even encoded) —
   * real-world names like "ChatGPT Image Aug 3, 2026, 09_30_41 PM.png"
   * (spaces, commas, ...) produced Supabase Storage "InvalidKey" errors
   * for some files. The original name is preserved separately in
   * patientRecords.fileName for display; the storage key only needs to
   * be a valid, unique object path.
   */
  private async storeFile(
    patientId: string,
    file: UploadedFile,
  ): Promise<{ recordId: string; path: string }> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    const recordId = crypto.randomUUID();
    const extensionMatch = /\.([a-zA-Z0-9]+)$/.exec(file.originalname);
    const extension = extensionMatch?.[1]
      ? `.${extensionMatch[1].toLowerCase()}`
      : '';
    const path = `${patientId}/${recordId}/file${extension}`;

    const { error: uploadError } = await this.storage.storage
      .from(BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }
    return { recordId, path };
  }

  /**
   * The clinic side of "a lab report came in" (journeys.html, Assistant ·
   * Step 02): staff attach a report to a patient's own vault, matched by
   * the pending appointment they picked — not by typing a name — so a
   * report can't land on the wrong same-named patient. Caller (ClinicService)
   * has already verified the appointment belongs to this clinic; this only
   * derives the subject from it and writes the record with source
   * 'clinic_push' and uploadedBy set to the staff member, not the patient,
   * so "who attached this" is always visible on the patient's own side too.
   */
  async attachRecord(
    appointmentId: string,
    attachedBy: string,
    recordType: UploadRecordMetadata['recordType'],
    file: UploadedFile,
  ) {
    const [appointment] = await this.db
      .select({
        patientId: appointments.patientId,
        subjectType: appointments.subjectType,
        familyMemberId: appointments.familyMemberId,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const { recordId, path } = await this.storeFile(
      appointment.patientId,
      file,
    );
    const [row] = await this.db
      .insert(patientRecords)
      .values({
        id: recordId,
        patientId: appointment.patientId,
        subjectType: appointment.subjectType,
        familyMemberId: appointment.familyMemberId,
        recordType,
        source: 'clinic_push',
        filePath: path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        linkedAppointmentId: appointmentId,
        uploadedBy: attachedBy,
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

  /**
   * Same signed-URL flow as getSignedUrl, but without the patientId
   * ownership check — for a caller (ClinicService) that has already
   * authorized access some other way, e.g. "this record is linked to an
   * appointment at a clinic this staff member belongs to."
   */
  async getSignedUrlForRecordUnchecked(
    recordId: string,
  ): Promise<{ url: string }> {
    const [row] = await this.db
      .select({ filePath: patientRecords.filePath })
      .from(patientRecords)
      .where(eq(patientRecords.id, recordId))
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
