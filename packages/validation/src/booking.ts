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

export const availabilityQuerySchema = z.object({
  practitionerId: z.string().uuid(),
  clinicId: z.string().uuid(),
  fromDate: z.string().date(),
  toDate: z.string().date(),
});
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
