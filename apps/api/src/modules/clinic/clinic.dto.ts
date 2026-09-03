import {
  assignPatientSchema,
  attachVaultRecordSchema,
  checkInAppointmentSchema,
  createClinicSchema,
  createPractitionerLeaveSchema,
  inviteStaffSchema,
  recordVitalsSchema,
  upsertMedicalSummarySchema,
  upsertPractitionerClinicSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class CreateClinicDto extends createZodDto(createClinicSchema) {}
export class UpsertPractitionerClinicDto extends createZodDto(
  upsertPractitionerClinicSchema,
) {}
export class CreatePractitionerLeaveDto extends createZodDto(
  createPractitionerLeaveSchema,
) {}
export class InviteStaffDto extends createZodDto(inviteStaffSchema) {}
export class CheckInAppointmentDto extends createZodDto(
  checkInAppointmentSchema,
) {}
export class UpsertMedicalSummaryDto extends createZodDto(
  upsertMedicalSummarySchema,
) {}
export class AssignPatientDto extends createZodDto(assignPatientSchema) {}
export class RecordVitalsDto extends createZodDto(recordVitalsSchema) {}
// fileName/mimeType come from the uploaded file itself (multer), not a
// separately-typed form field — see ClinicController.attachRecord and
// VaultController.upload's identical pattern.
export class AttachVaultRecordDto extends createZodDto(
  attachVaultRecordSchema.omit({ fileName: true, mimeType: true }),
) {}
