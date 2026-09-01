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

/**
 * A single Rx pad line. drugName is the only required field — dosage/
 * frequency/duration/instructions stay free text (real prescriber
 * shorthand, e.g. "1×0×0", varies too much for a rigid format) rather
 * than structured enums.
 */
export const prescriptionItemSchema = z.object({
  drugName: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  duration: z.string().max(100).optional(),
  instructions: z.string().max(300).optional(),
});
export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

/**
 * Replaces the whole prescription for a visit — not a per-line add/edit/
 * delete API. The response flags drug names that keyword-match the
 * patient's recorded allergies (ClinicalService.savePrescription) as an
 * informational warning, not a save-blocking check — it's not a real
 * drug-interaction/cross-reactivity check, just a plain string match, so
 * the web form's human-review confirmation (not this schema) is the real
 * safety gate.
 */
export const savePrescriptionSchema = z.object({
  items: z.array(prescriptionItemSchema).max(20),
});
export type SavePrescriptionInput = z.infer<typeof savePrescriptionSchema>;
