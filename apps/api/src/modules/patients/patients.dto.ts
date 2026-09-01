import {
  addFamilyMemberSchema,
  updateFamilyMemberSchema,
  updatePatientProfileSchema,
  upsertMedicalSummarySchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class UpdatePatientProfileDto extends createZodDto(
  updatePatientProfileSchema,
) {}
export class AddFamilyMemberDto extends createZodDto(addFamilyMemberSchema) {}
export class UpdateFamilyMemberDto extends createZodDto(
  updateFamilyMemberSchema,
) {}
export class UpsertMedicalSummaryDto extends createZodDto(
  upsertMedicalSummarySchema,
) {}
