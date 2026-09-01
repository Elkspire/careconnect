import { rejectPractitionerSchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class RejectPractitionerDto extends createZodDto(
  rejectPractitionerSchema,
) {}
