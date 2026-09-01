import { z } from "zod";

export const rejectPractitionerSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type RejectPractitionerInput = z.infer<typeof rejectPractitionerSchema>;
