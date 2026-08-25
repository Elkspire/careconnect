import {
  availabilityQuerySchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  joinWaitlistSchema,
  rescheduleAppointmentSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class AvailabilityQueryDto extends createZodDto(
  availabilityQuerySchema,
) {}
export class CreateAppointmentDto extends createZodDto(
  createAppointmentSchema,
) {}
export class RescheduleAppointmentDto extends createZodDto(
  rescheduleAppointmentSchema,
) {}
export class CancelAppointmentDto extends createZodDto(
  cancelAppointmentSchema,
) {}
export class JoinWaitlistDto extends createZodDto(joinWaitlistSchema) {}
