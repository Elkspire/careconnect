import {
  createClinicalNoteSchema,
  updateClinicalNoteSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class CreateClinicalNoteDto extends createZodDto(
  createClinicalNoteSchema,
) {}
export class UpdateClinicalNoteDto extends createZodDto(
  updateClinicalNoteSchema,
) {}
