import type { CreateShareInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./client";

export interface RecordShare {
  id: string;
  subjectType: string;
  familyMemberId: string | null;
  familyMemberFullName: string | null;
  token: string;
  includeClinicalHistory: boolean;
  includeLabReports: boolean;
  includeOtherRecords: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  accessCount: number;
}

export async function listMyShares(): Promise<RecordShare[]> {
  const res = await authedFetch("/shares");
  return parseJsonOrThrow(res, "List shares");
}

export async function createShare(input: CreateShareInput): Promise<RecordShare> {
  const res = await authedFetch("/shares", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Create share");
}

export async function revokeShare(shareId: string): Promise<void> {
  const res = await authedFetch(`/shares/${shareId}/revoke`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Revoke share failed: ${res.status}`);
  }
}

// Opening the shared bundle itself (getSharedBundle) is deliberately not
// mirrored here — that view is for a doctor without a CareConnect account
// opening the web link (apps/web's /s/[token] page), not a screen inside
// this app. The share link a patient creates here is shared out via the
// native share sheet pointing at that same web URL.
