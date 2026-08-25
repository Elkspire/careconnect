import {
  checkInAppointmentSchema,
  createClinicSchema,
  createPractitionerLeaveSchema,
  inviteReceptionistSchema,
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
export class InviteReceptionistDto extends createZodDto(
  inviteReceptionistSchema,
) {}
export class CheckInAppointmentDto extends createZodDto(
  checkInAppointmentSchema,
) {}
