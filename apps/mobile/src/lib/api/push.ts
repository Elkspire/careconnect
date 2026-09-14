import { authedFetch } from "./client";

export async function registerExpoPushToken(token: string): Promise<void> {
  const res = await authedFetch("/notifications/push/expo-tokens", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`Register push token failed: ${res.status}`);
  }
}

export async function unregisterExpoPushToken(token: string): Promise<void> {
  const res = await authedFetch("/notifications/push/expo-tokens", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`Unregister push token failed: ${res.status}`);
  }
}
