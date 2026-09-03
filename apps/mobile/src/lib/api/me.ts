import { authedFetch, parseJsonOrThrow } from "./client";

export interface MeResponse {
  id: string;
  phone?: string;
  email?: string;
  patient: { id: string; fullName: string; preferredLanguage: string } | null;
  practitioner: { id: string; fullName: string; verificationStatus: string } | null;
  clinicStaff: {
    clinicId: string;
    clinicSlug: string;
    clinicName: string;
    role: string;
    status: string;
  }[];
}

export async function getMe(): Promise<MeResponse> {
  const res = await authedFetch("/me");
  return parseJsonOrThrow(res, "Get current user");
}
