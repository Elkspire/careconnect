import { createShareSchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class CreateShareDto extends createZodDto(createShareSchema) {}
