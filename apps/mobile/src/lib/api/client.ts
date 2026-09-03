import { supabase } from "../supabase";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
  }
}

/** Attaches the current session's access token when one exists; never throws for a signed-out caller — public routes (directory, availability) don't need one. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (session) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** Same as apiFetch, but for routes that require a session — throws rather than silently calling the API unauthenticated. */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new UnauthenticatedError();
  }
  return apiFetch(path, init);
}

export async function parseJsonOrThrow<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed: ${res.status} ${body}`);
  }
  return res.json();
}
