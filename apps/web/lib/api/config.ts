export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// `npm run dev` starts web and API together, but Next is ready in about a
// second while Nest takes 20s+ to compile and boot. Any page opened in that
// window used to crash with a bare "TypeError: fetch failed". In
// development only, server-side calls wait for the API instead.
const DEV_STARTUP_WAIT_MS = 30_000;
const RETRY_DELAY_MS = 1_000;

function isConnectionRefused(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } } | undefined)?.cause;
  return err instanceof TypeError && cause?.code === "ECONNREFUSED";
}

/**
 * fetch() against the NestJS API (`path` starts with "/"). Retries only on
 * ECONNREFUSED — the request never reached the API, so retrying is safe
 * even for POSTs — and only on the server in development; in production,
 * or for any real HTTP response, it behaves exactly like fetch().
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_URL}${path}`;
  const shouldWait = process.env.NODE_ENV === "development" && typeof window === "undefined";
  const deadline = Date.now() + DEV_STARTUP_WAIT_MS;

  for (;;) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (!shouldWait || !isConnectionRefused(err) || Date.now() >= deadline) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}
