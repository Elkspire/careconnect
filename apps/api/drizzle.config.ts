import { defineConfig } from "drizzle-kit";

/**
 * Used only for `drizzle-kit pull` (introspection) against the local
 * Supabase Postgres instance, to verify/regenerate src/common/database/schema.ts
 * against supabase/migrations/0001_init.sql — migrations themselves are
 * owned by the Supabase CLI, not drizzle-kit.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/common/database/schema.ts",
  out: "./.drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
