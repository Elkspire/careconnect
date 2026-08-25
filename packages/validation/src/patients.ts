import { z } from "zod";
import { FAMILY_RELATIONSHIP, GENDER, PREFERRED_LANGUAGE } from "@careconnect/shared-types";

export const updatePatientProfileSchema = z.object({
  fullName: z.string().min(1).max(120),
  gender: z.enum(GENDER).optional(),
  dob: z.string().date().optional(),
  preferredLanguage: z.enum(PREFERRED_LANGUAGE),
  email: z.string().email().optional(),
});
export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;

export const addFamilyMemberSchema = z.object({
  fullName: z.string().min(1).max(120),
  relationship: z.enum(FAMILY_RELATIONSHIP),
  dob: z.string().date().optional(),
  gender: z.enum(GENDER).optional(),
});
export type AddFamilyMemberInput = z.infer<typeof addFamilyMemberSchema>;

export const updateFamilyMemberSchema = addFamilyMemberSchema.partial();
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;
