import { z } from "zod";
import {
  CLINIC_STAFF_ROLE,
  ROLE_PERMISSION_CEILING,
  STAFF_PERMISSION_KEY,
  type AssignableStaffRole,
} from "@careconnect/shared-types";
import { phoneSchema } from "./auth";

export const inviteStaffSchema = z
  .object({
    clinicId: z.string().uuid(),
    // Whichever identifier the invitee actually signed up with — phone
    // login is currently disabled app-wide (see PHONE_LOGIN_ENABLED in
    // apps/web and apps/mobile's login screens), so an invite needs to be
    // able to find someone by email too, not just phone.
    phone: phoneSchema.optional(),
    email: z.string().email().optional(),
    fullName: z.string().min(1).max(120),
    role: z.enum(CLINIC_STAFF_ROLE).refine((r) => r !== "owner", {
      message: "Cannot invite a second owner; owner is set at clinic creation",
    }),
    // Permissions the doctor has explicitly toggled off for this staff
    // member, narrowing them below their role's default ceiling — never
    // widening it (see ROLE_PERMISSION_CEILING). Defaults to none, i.e.
    // the role's full default permission set.
    deniedPermissions: z.array(z.enum(STAFF_PERMISSION_KEY)).default([]),
  })
  .refine((input) => !!input.phone || !!input.email, {
    message: "Provide a phone number or an email address",
    path: ["email"],
  })
  .refine(
    (input) => {
      const ceiling = ROLE_PERMISSION_CEILING[input.role as AssignableStaffRole] ?? [];
      return input.deniedPermissions.every((p) => ceiling.includes(p));
    },
    {
      message: "Cannot deny a permission this role wasn't granted in the first place",
      path: ["deniedPermissions"],
    },
  );
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const revokeStaffSchema = z.object({
  clinicStaffId: z.string().uuid(),
});
export type RevokeStaffInput = z.infer<typeof revokeStaffSchema>;

// A junior doctor only sees patients explicitly assigned to them at this
// clinic — this is the owner-side action that grants that visibility.
export const assignPatientSchema = z.object({
  juniorDoctorUserId: z.string().uuid(),
  patientId: z.string().uuid(),
  familyMemberId: z.string().uuid().optional(),
});
export type AssignPatientInput = z.infer<typeof assignPatientSchema>;
