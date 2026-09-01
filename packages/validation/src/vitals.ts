import { z } from "zod";

/**
 * The assistant's four measurements (journeys.html, Assistant · Step 01).
 * All individually optional — a busy assistant may not always capture all
 * four — but at least one is required, so an empty "save" can't silently
 * create a blank row.
 */
export const recordVitalsSchema = z
  .object({
    systolicMmhg: z.number().int().min(40).max(300).optional(),
    diastolicMmhg: z.number().int().min(20).max(200).optional(),
    pulseBpm: z.number().int().min(20).max(250).optional(),
    weightKg: z.number().min(0.5).max(400).optional(),
    temperatureF: z.number().min(80).max(115).optional(),
  })
  .refine(
    (input) =>
      input.systolicMmhg !== undefined ||
      input.diastolicMmhg !== undefined ||
      input.pulseBpm !== undefined ||
      input.weightKg !== undefined ||
      input.temperatureF !== undefined,
    { message: "At least one measurement is required" },
  );
export type RecordVitalsInput = z.infer<typeof recordVitalsSchema>;
