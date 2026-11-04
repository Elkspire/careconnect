import { authedFetch, parseJsonOrThrow } from "./authedFetch";

/** What deleting the signed-in account would remove (see the API's AccountService). */
export interface DeletionPreview {
  isPatient: boolean;
  isPractitioner: boolean;
  ownedClinics: Array<{ id: string; name: string }>;
  upcomingAtOwnedClinics: number;
  upcomingAsPatient: number;
}

export async function getDeletionPreview(): Promise<DeletionPreview> {
  const res = await authedFetch("/me/deletion-preview");
  return parseJsonOrThrow(res, "Get deletion preview");
}

/** Permanently deletes the signed-in account. */
export async function deleteMyAccount(): Promise<void> {
  const res = await authedFetch("/me", { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Delete account failed: ${res.status} ${await res.text()}`);
  }
}
