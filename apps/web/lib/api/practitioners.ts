import type { RegisterPractitionerInput } from "@careconnect/validation";
import type { PractitionerType } from "@careconnect/shared-types";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";
import { API_URL } from "./config";

export interface Practitioner {
  id: string;
  slug: string;
  fullName: string;
  practitionerType: PractitionerType;
  verificationStatus: string;
}

export async function registerPractitioner(
  input: RegisterPractitionerInput,
): Promise<Practitioner> {
  const res = await authedFetch("/practitioners/me", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Register practitioner");
}

export interface Specialty {
  id: string;
  nameEn: string;
  nameUr: string | null;
  practitionerType: PractitionerType;
  slug: string;
}

// Public — no auth needed to see what specialties exist.
export async function listSpecialties(
  practitionerType?: PractitionerType,
): Promise<Specialty[]> {
  const qs = practitionerType ? `?practitionerType=${practitionerType}` : "";
  const res = await fetch(`${API_URL}/directory/specialties${qs}`);
  return parseJsonOrThrow(res, "List specialties");
}
