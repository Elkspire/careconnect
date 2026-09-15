import { registerPractitionerSchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class RegisterPractitionerDto extends createZodDto(
  registerPractitionerSchema,
) {}
