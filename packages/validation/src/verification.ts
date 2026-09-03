import { z } from "zod";
import { VERIFICATION_DOCUMENT_TYPE } from "@careconnect/shared-types";

/**
 * Describes the document being uploaded; the file bytes themselves travel
 * as multipart form data, not through this schema — same split as
 * uploadVaultRecordSchema.
 */
export const uploadVerificationDocumentSchema = z.object({
  documentType: z.enum(VERIFICATION_DOCUMENT_TYPE),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
});
export type UploadVerificationDocumentInput = z.infer<
  typeof uploadVerificationDocumentSchema
>;
