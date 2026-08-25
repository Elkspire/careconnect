import {
  listVaultRecordsQuerySchema,
  uploadVaultRecordSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

// fileName/mimeType come from the uploaded file itself (multer), not a
// separately-typed form field — see VaultController.upload.
export class UploadVaultRecordDto extends createZodDto(
  uploadVaultRecordSchema.omit({ fileName: true, mimeType: true }),
) {}
export class ListVaultRecordsQueryDto extends createZodDto(
  listVaultRecordsQuerySchema,
) {}
