import { createClient } from "@/lib/supabase/server";
import { API_URL } from "./config";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
  }
}

/** Server-only — attaches the current Supabase session's access token to a NestJS API call. */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new UnauthenticatedError();
  }

  // FormData bodies (vault uploads) must NOT get an explicit Content-Type —
  // fetch sets the multipart boundary itself only when it's left unset.
  const isFormData = init?.body instanceof FormData;

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });
}

export async function parseJsonOrThrow<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed: ${res.status} ${body}`);
  }
  return res.json();
}
