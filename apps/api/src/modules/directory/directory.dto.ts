import { directorySearchQuerySchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class DirectorySearchQueryDto extends createZodDto(
  directorySearchQuerySchema,
) {}
