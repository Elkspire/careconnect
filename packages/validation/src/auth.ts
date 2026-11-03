import { z } from "zod";

/**
 * E.164 phone number, required for Supabase phone-OTP auth.
 * Example: +923001234567
 */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format, e.g. +923001234567");

/**
 * Turns what people actually type into E.164 before it reaches Supabase:
 * strips spaces/dashes/brackets, and maps Pakistani local formats
 * ("03001234567", "923001234567", "00923001234567") to "+923001234567".
 * Anything else is returned cleaned but otherwise untouched, so
 * phoneSchema still gets the final say.
 */
export function normalizePhone(input: string): string {
  let p = input.trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (/^03\d{9}$/.test(p)) p = `+92${p.slice(1)}`;
  if (/^92\d{10}$/.test(p)) p = `+${p}`;
  return p;
}

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
  phone: phoneSchema,
  role: z.enum(["patient", "practitioner", "staff"]),
});
export type CheckRoleEligibilityQuery = z.infer<typeof checkRoleEligibilitySchema>;
