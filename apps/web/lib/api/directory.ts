import type { DirectorySearchQuery } from "@careconnect/validation";
import { API_URL } from "./config";

export interface DirectoryListing {
  practitionerId: string;
  practitionerSlug: string;
  fullName: string;
  gender: string | null;
  practitionerType: string;
  verificationStatus: string;
  languages: string[];
  averageRating: number | null;
  reviewCount: number;
  specialties: Array<{ id: string; nameEn: string; nameUr: string | null }>;
  clinic: { id: string; slug: string; name: string; city: string; area: string };
  consultationFee: string;
  slotLengthMinutes: number;
}

export interface DirectorySearchResult {
  results: DirectoryListing[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PractitionerProfile {
  id: string;
  slug: string;
  fullName: string;
  gender: string | null;
  practitionerType: string;
  verificationStatus: string;
  bio: string | null;
  languages: string[];
  averageRating: number | null;
  reviewCount: number;
  specialties: Array<{ id: string; nameEn: string; nameUr: string | null }>;
  clinics: Array<{
    id: string;
    slug: string;
    name: string;
    city: string;
    area: string;
    address: string;
    phone: string | null;
    consultationFee: string;
    slotLengthMinutes: number;
  }>;
}

function toSearchParams(query: Partial<DirectorySearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}

// Directory listings change infrequently — revalidated periodically rather
// than on every request, per the plan's ISR strategy for public pages.
const DIRECTORY_REVALIDATE_SECONDS = 60;

export async function searchPractitioners(
  query: Partial<DirectorySearchQuery> & { city: string },
): Promise<DirectorySearchResult> {
  const params = toSearchParams(query);
  const res = await fetch(`${API_URL}/directory/practitioners?${params.toString()}`, {
    next: { revalidate: DIRECTORY_REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Directory search failed: ${res.status}`);
  }
  return res.json();
}

export async function getPractitionerProfile(slug: string): Promise<PractitionerProfile | null> {
  const res = await fetch(`${API_URL}/directory/practitioners/${slug}`, {
    next: { revalidate: DIRECTORY_REVALIDATE_SECONDS },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Practitioner profile fetch failed: ${res.status}`);
  }
  return res.json();
}
