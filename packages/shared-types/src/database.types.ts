/**
 * Placeholder. Regenerate this file once the Supabase migrations exist and a
 * local Supabase instance is running:
 *
 *   pnpm db:gen-types
 *
 * which runs: supabase gen types typescript --local --schema public
 *
 * Do not hand-edit past this point once generated.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
