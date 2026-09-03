import { z } from "zod";
import { APPOINTMENT_SUBJECT_TYPE, RECORD_TYPE } from "@careconnect/shared-types";

/**
 * Describes the record being uploaded; the file bytes themselves travel as
 * multipart form data, not through this schema.
 */
export const uploadVaultRecordSchema = z.object({
  subjectType: z.enum(APPOINTMENT_SUBJECT_TYPE),
  familyMemberId: z.string().uuid().optional(),
  recordType: z.enum(RECORD_TYPE),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/heic"]),
  linkedAppointmentId: z.string().uuid().optional(),
});
export type UploadVaultRecordInput = z.infer<typeof uploadVaultRecordSchema>;

export const listVaultRecordsQuerySchema = z.object({
  subjectType: z.enum(APPOINTMENT_SUBJECT_TYPE).optional(),
  familyMemberId: z.string().uuid().optional(),
  recordType: z.enum(RECORD_TYPE).optional(),
});
export type ListVaultRecordsQuery = z.infer<typeof listVaultRecordsQuerySchema>;

/**
 * Clinic staff attaching an incoming report to a patient's vault
 * (journeys.html, Assistant · Step 02) — deliberately keyed by
 * appointmentId, not patientId: "matched by the pending order, not the
 * name" is the whole safety point, so there's no free-text patient field
 * here to misattach against a same-named patient.
 */
export const attachVaultRecordSchema = z.object({
  appointmentId: z.string().uuid(),
  recordType: z.enum(RECORD_TYPE),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/heic"]),
});
export type AttachVaultRecordInput = z.infer<typeof attachVaultRecordSchema>;
