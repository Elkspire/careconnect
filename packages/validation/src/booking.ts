import { z } from "zod";
import { APPOINTMENT_SUBJECT_TYPE } from "@careconnect/shared-types";

const bookingSubject = z
  .object({
    subjectType: z.enum(APPOINTMENT_SUBJECT_TYPE),
    familyMemberId: z.string().uuid().optional(),
  })
  .refine((v) => (v.subjectType === "family_member" ? !!v.familyMemberId : true), {
    message: "familyMemberId is required when subjectType is family_member",
    path: ["familyMemberId"],
  });

/** The availability endpoint is public and does work per day asked for. */
export const MAX_AVAILABILITY_DAYS = 31;

export const availabilityQuerySchema = z
  .object({
    practitionerId: z.string().uuid(),
    clinicId: z.string().uuid(),
    fromDate: z.string().date(),
    toDate: z.string().date(),
  })
  .refine((v) => v.fromDate <= v.toDate, {
    message: "fromDate must be on or before toDate",
    path: ["toDate"],
  })
  .refine(
    (v) => (Date.parse(v.toDate) - Date.parse(v.fromDate)) / 86_400_000 < MAX_AVAILABILITY_DAYS,
    { message: `Ask for at most ${MAX_AVAILABILITY_DAYS} days at a time`, path: ["toDate"] },
  );
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const createAppointmentSchema = bookingSubject.and(
  z.object({
    practitionerId: z.string().uuid(),
    clinicId: z.string().uuid(),
    scheduledStart: z.string().datetime(),
  }),
);
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
});
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const checkInAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
});
export type CheckInAppointmentInput = z.infer<typeof checkInAppointmentSchema>;

export const joinWaitlistSchema = bookingSubject.and(
  z.object({
    practitionerId: z.string().uuid(),
    clinicId: z.string().uuid(),
    requestedDate: z.string().date(),
  }),
);
export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
