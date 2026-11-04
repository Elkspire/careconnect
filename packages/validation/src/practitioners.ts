import { z } from "zod";
import { GENDER, PRACTITIONER_TYPE } from "@careconnect/shared-types";

export const registerPractitionerSchema = z.object({
  fullName: z.string().min(1).max(120),
  gender: z.enum(GENDER),
  practitionerType: z.enum(PRACTITIONER_TYPE),
  councilRegistrationNo: z.string().min(1).max(60),
  bio: z.string().max(2000).optional(),
  languages: z.array(z.string().min(1).max(40)).min(1),
  specialtyIds: z.array(z.string().uuid()).min(1),
});
export type RegisterPractitionerInput = z.infer<typeof registerPractitionerSchema>;

export const updatePractitionerProfileSchema = registerPractitionerSchema
  .omit({ councilRegistrationNo: true })
  .partial();
export type UpdatePractitionerProfileInput = z.infer<typeof updatePractitionerProfileSchema>;

/** Admin-only: sets verification_status after registration is checked against the national register. */
export const setVerificationStatusSchema = z.object({
  practitionerId: z.string().uuid(),
  status: z.enum(["unverified", "pending", "verified"]),
});
export type SetVerificationStatusInput = z.infer<typeof setVerificationStatusSchema>;

// Clinic-local (Asia/Karachi) wall-clock times; "HH:mm" compares correctly
// as a string, so no parsing is needed for the ordering checks below.
const dayTimeRange = z
  .object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm"),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm"),
  })
  .refine((r) => r.end > r.start, {
    message: "Each time range must end after it starts",
    path: ["end"],
  });

const dayRanges = z
  .array(dayTimeRange)
  .default([])
  .refine(
    (ranges) => {
      const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
      return sorted.every((r, i) => i === 0 || r.start >= sorted[i - 1]!.end);
    },
    { message: "Time ranges on the same day can't overlap" },
  );

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const weeklyTimings = z.object({
  mon: dayRanges,
  tue: dayRanges,
  wed: dayRanges,
  thu: dayRanges,
  fri: dayRanges,
  sat: dayRanges,
  sun: dayRanges,
});
export type WeeklyTimings = z.infer<typeof weeklyTimings>;

export const upsertPractitionerClinicSchema = z.object({
  clinicId: z.string().uuid(),
  consultationFee: z.number().nonnegative(),
  slotLengthMinutes: z.number().int().min(5).max(240),
  dailyPatientCap: z.number().int().positive().optional(),
  timings: weeklyTimings,
  isActive: z.boolean().default(true),
  cancellationWindowHours: z.number().int().min(0).max(168).default(24),
});
export type UpsertPractitionerClinicInput = z.infer<typeof upsertPractitionerClinicSchema>;

export const createClinicSchema = z.object({
  name: z.string().min(1).max(160),
  city: z.string().min(1).max(80),
  area: z.string().min(1).max(80),
  address: z.string().min(1).max(300),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: phoneNumberOrUndefined(),
});
export type CreateClinicInput = z.infer<typeof createClinicSchema>;

export const createPractitionerLeaveSchema = z
  .object({
    clinicId: z.string().uuid().optional(),
    startsOn: z.string().date(),
    endsOn: z.string().date(),
    reason: z.string().max(300).optional(),
  })
  .refine((v) => v.startsOn <= v.endsOn, {
    message: "startsOn must be on or before endsOn",
    path: ["endsOn"],
  });
export type CreatePractitionerLeaveInput = z.infer<typeof createPractitionerLeaveSchema>;

function phoneNumberOrUndefined() {
  return z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .optional();
}
