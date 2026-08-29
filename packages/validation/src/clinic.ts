import { z } from "zod";
import { CLINIC_STAFF_ROLE } from "@careconnect/shared-types";
import { phoneSchema } from "./auth";

export const inviteStaffSchema = z.object({
  clinicId: z.string().uuid(),
  phone: phoneSchema,
  fullName: z.string().min(1).max(120),
  role: z.enum(CLINIC_STAFF_ROLE).refine((r) => r !== "owner", {
    message: "Cannot invite a second owner; owner is set at clinic creation",
  }),
});
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const revokeStaffSchema = z.object({
  clinicStaffId: z.string().uuid(),
});
export type RevokeStaffInput = z.infer<typeof revokeStaffSchema>;
