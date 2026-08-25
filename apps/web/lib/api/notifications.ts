import { authedFetch, parseJsonOrThrow } from "./authedFetch";

export interface NotificationLogEntry {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export async function listMyNotifications(): Promise<NotificationLogEntry[]> {
  const res = await authedFetch("/notifications/mine");
  return parseJsonOrThrow(res, "List notifications");
}

// Push subscribe/unsubscribe are called from components/push-notifications.tsx,
// a Client Component — it talks to the API directly rather than through
// authedFetch (server-only: reads the session via next/headers, which
// breaks the build if pulled into a client bundle).
