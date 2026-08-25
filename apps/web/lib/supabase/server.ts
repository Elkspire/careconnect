import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Creates a fresh Supabase client per Server Component render, per
 * @supabase/ssr's own guidance — never share a client across requests.
 * Cookie writes silently no-op when called from a Server Component (they
 * can't set cookies); proxy.ts is what refreshes the session on navigation.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — proxy.ts handles session refresh.
        }
      },
    },
  });
}
