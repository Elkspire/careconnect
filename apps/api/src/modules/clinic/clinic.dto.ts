import {
  checkInAppointmentSchema,
  createClinicSchema,
  createPractitionerLeaveSchema,
  inviteStaffSchema,
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
