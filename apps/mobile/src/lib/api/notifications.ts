import { authedFetch, parseJsonOrThrow } from "./client";

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
