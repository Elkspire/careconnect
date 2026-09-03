import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UploadVerificationDocumentInput } from '@careconnect/validation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { practitionerVerificationDocuments } from '../../common/database/schema';
import { SUPABASE_STORAGE } from '../../common/storage/storage.module';

const BUCKET = 'practitioner-documents';
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const SIGNED_URL_TTL_SECONDS = 300;

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export type UploadDocumentMetadata = Omit<
  UploadVerificationDocumentInput,
  'fileName' | 'mimeType'
>;

/**
 * What AdminService's verification review actually checks — CNIC, degree,
 * council registration certificate — instead of only the registration
 * number a practitioner typed into a form. Same "signed URL, private
 * bucket, service-role for admin reads" shape as VaultService.
 */
@Injectable()
export class VerificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SUPABASE_STORAGE) private readonly storage: SupabaseClient,
  ) {}

  async uploadDocument(
    practitionerId: string,
    input: UploadDocumentMetadata,
    file: UploadedFile,
  ) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const documentId = crypto.randomUUID();
    const extensionMatch = /\.([a-zA-Z0-9]+)$/.exec(file.originalname);
    const extension = extensionMatch?.[1]
      ? `.${extensionMatch[1].toLowerCase()}`
      : '';
    const path = `${practitionerId}/${documentId}/file${extension}`;

    const { error: uploadError } = await this.storage.storage
      .from(BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const [row] = await this.db
      .insert(practitionerVerificationDocuments)
      .values({
        id: documentId,
        practitionerId,
        documentType: input.documentType,
        filePath: path,
        fileName: file.originalname,
        mimeType: file.mimetype,
      })
      .returning();
    return row;
  }

  listMine(practitionerId: string) {
    return this.db
      .select({
        id: practitionerVerificationDocuments.id,
        documentType: practitionerVerificationDocuments.documentType,
        fileName: practitionerVerificationDocuments.fileName,
        uploadedAt: practitionerVerificationDocuments.uploadedAt,
      })
      .from(practitionerVerificationDocuments)
      .where(
        eq(practitionerVerificationDocuments.practitionerId, practitionerId),
      )
      .orderBy(desc(practitionerVerificationDocuments.uploadedAt));
  }

  async deleteDocument(
    practitionerId: string,
    documentId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ filePath: practitionerVerificationDocuments.filePath })
      .from(practitionerVerificationDocuments)
      .where(
        and(
          eq(practitionerVerificationDocuments.id, documentId),
          eq(practitionerVerificationDocuments.practitionerId, practitionerId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Document not found');
    }
    await this.storage.storage.from(BUCKET).remove([row.filePath]);
    await this.db
      .delete(practitionerVerificationDocuments)
      .where(eq(practitionerVerificationDocuments.id, documentId));
  }

  /** Admin-side: every document a practitioner has uploaded, for the verification queue. */
  listForPractitioner(practitionerId: string) {
    return this.listMine(practitionerId);
  }

  /** Admin-side: no ownership check — AdminGuard already establishes the caller is an admin. */
  async getSignedUrlUnchecked(documentId: string): Promise<{ url: string }> {
    const [row] = await this.db
      .select({ filePath: practitionerVerificationDocuments.filePath })
      .from(practitionerVerificationDocuments)
      .where(eq(practitionerVerificationDocuments.id, documentId))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Document not found');
    }
    const { data, error } = await this.storage.storage
      .from(BUCKET)
      .createSignedUrl(row.filePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      throw new NotFoundException(
        'Could not generate a signed URL for this document',
      );
    }
    return { url: data.signedUrl };
  }
}
