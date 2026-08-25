/**
 * Read lazily (called from inside client/server factory functions, not at
 * module load) so `next build` can statically collect page config without a
 * real Supabase project configured yet — see README for required env vars.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — see apps/web/.env.example",
    );
  }
  return { url, anonKey };
}
