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
  // res.json() on a genuinely empty body throws a bare, contextless
  // "Unexpected end of JSON input" -- confirmed the actual cause of a real
  // page crash (patient vault page) with no way to tell which of six
  // parallel API calls it was. Reading as text first means a bad response
  // says which endpoint and what it actually returned, instead of a native
  // SyntaxError with a stack trace pointing at JSON.parse itself.
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `${context}: response was not valid JSON (status ${res.status}, body: ${JSON.stringify(text)})`,
    );
  }
}
