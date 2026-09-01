import { z } from "zod";

/**
 * "Share for a second opinion" (journeys.html, Patient · Step 07). Scope is
 * three real toggles backed by the vault's own record_type distinction
 * (lab_report vs. everything else) plus the visit history as a whole —
 * there's no data model support for filtering visit history down to one
 * specialty/condition, so that half of the mockup's "Cardiology history
 * only" toggle is intentionally simplified to all-or-nothing here.
 */
export const createShareSchema = z
  .object({
    subjectType: z.enum(["self", "family_member"]).default("self"),
    familyMemberId: z.string().uuid().optional(),
    includeClinicalHistory: z.boolean().default(true),
    includeLabReports: z.boolean().default(true),
    includeOtherRecords: z.boolean().default(false),
    duration: z.enum(["24h", "7d", "forever"]).default("7d"),
  })
  .refine((input) => input.subjectType === "self" || !!input.familyMemberId, {
    message: "familyMemberId is required when sharing a family member's record",
    path: ["familyMemberId"],
  });
export type CreateShareInput = z.infer<typeof createShareSchema>;
