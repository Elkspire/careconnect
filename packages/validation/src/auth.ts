import { z } from "zod";

/**
 * E.164 phone number, required for Supabase phone-OTP auth.
 * Example: +923001234567
 */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format, e.g. +923001234567");

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, "OTP code must be 6 digits"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const checkRoleEligibilitySchema = z.object({
  email: z.string().email(),
  role: z.enum(["patient", "practitioner", "staff"]),
});
export type CheckRoleEligibilityQuery = z.infer<typeof checkRoleEligibilitySchema>;
