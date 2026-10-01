import { checkRoleEligibilitySchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class CheckRoleEligibilityQueryDto extends createZodDto(
  checkRoleEligibilitySchema,
) {}
