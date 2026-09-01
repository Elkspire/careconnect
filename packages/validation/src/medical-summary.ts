import { z } from "zod";
import { BLOOD_GROUP } from "@careconnect/shared-types";

export const upsertMedicalSummarySchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUP).optional(),
  allergies: z.array(z.string().min(1).max(120)).max(30).default([]),
  chronicConditions: z.array(z.string().min(1).max(120)).max(30).default([]),
  activeMedications: z.array(z.string().min(1).max(120)).max(30).default([]),
});
export type UpsertMedicalSummaryInput = z.infer<typeof upsertMedicalSummarySchema>;
