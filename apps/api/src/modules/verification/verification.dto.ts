import { uploadVerificationDocumentSchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

// fileName/mimeType come from the uploaded file itself (multer), not a
// separately-typed form field — see VaultController.upload's identical
// pattern (packages/validation's schema stays the single source of truth
// for the web form's shape; this DTO is just narrower for what the
// multipart body actually carries).
export class UploadVerificationDocumentDto extends createZodDto(
  uploadVerificationDocumentSchema.omit({ fileName: true, mimeType: true }),
) {}
