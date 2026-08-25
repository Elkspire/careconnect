import { z } from "zod";
import { GENDER, PRACTITIONER_TYPE } from "@careconnect/shared-types";

export const directorySearchQuerySchema = z.object({
  city: z.string().min(1).max(80),
  area: z.string().min(1).max(80).optional(),
  specialtyId: z.string().uuid().optional(),
  practitionerType: z.enum(PRACTITIONER_TYPE).optional(),
  q: z.string().max(120).optional(),
  minFee: z.coerce.number().nonnegative().optional(),
  maxFee: z.coerce.number().nonnegative().optional(),
  gender: z.enum(GENDER).optional(),
  language: z.string().max(40).optional(),
  nextAvailableOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type DirectorySearchQuery = z.infer<typeof directorySearchQuerySchema>;
