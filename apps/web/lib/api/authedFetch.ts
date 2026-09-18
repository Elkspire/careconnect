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
  const text = await res.text();
  // Confirmed root cause of a real page crash (patient vault page):
  // Nest sends a genuinely empty body -- not the JSON literal "null" -- for
  // a handler that returns null or undefined (see MedicalSummaryService.get,
  // "null, not 404, an unset summary is a normal empty state"). Every
  // caller of an endpoint with that shape already types its return as
  // `T | null`, so treating "no body" as `null` matches what they expect
  // instead of failing to parse it as JSON at all.
  if (text === "") {
    return null as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // Reading as text first (rather than res.json()) means a genuinely
    // malformed response says which endpoint and what it actually returned,
    // instead of a native SyntaxError with a stack trace pointing at
    // JSON.parse itself and nothing about which of several parallel calls
    // it was.
    throw new Error(
      `${context}: response was not valid JSON (status ${res.status}, body: ${JSON.stringify(text)})`,
    );
  }
}
