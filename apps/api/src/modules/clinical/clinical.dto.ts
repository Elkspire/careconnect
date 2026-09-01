import {
  createClinicalNoteSchema,
  savePrescriptionSchema,
  updateClinicalNoteSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class CreateClinicalNoteDto extends createZodDto(
  createClinicalNoteSchema,
) {}
export class UpdateClinicalNoteDto extends createZodDto(
  updateClinicalNoteSchema,
) {}
export class SavePrescriptionDto extends createZodDto(savePrescriptionSchema) {}
