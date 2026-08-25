import { z } from "zod";

/**
 * Only ever reachable via ClinicalModule, guarded to clinic_staff role='owner'.
 * See apps/api/src/modules/clinical and the Phase 1 plan's RLS/RBAC notes.
 */
export const createClinicalNoteSchema = z.object({
  appointmentId: z.string().uuid(),
  notes: z.string().min(1).max(10_000),
  diagnosis: z.string().max(2000).optional(),
});
export type CreateClinicalNoteInput = z.infer<typeof createClinicalNoteSchema>;

export const updateClinicalNoteSchema = createClinicalNoteSchema
  .omit({ appointmentId: true })
  .partial();
export type UpdateClinicalNoteInput = z.infer<typeof updateClinicalNoteSchema>;
