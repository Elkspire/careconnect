-- Human-readable identifiers for public-facing URLs (/practitioners/dr-ayesha-khan
-- instead of /practitioners/11111111-...). Additive migration — 0001 already
-- shipped conceptually, don't edit it in place. Safe to add as NOT NULL
-- UNIQUE directly: applied via `supabase db reset`, which always runs
-- migrations against an empty database before seed.sql populates rows.

alter table public.practitioners
  add column slug text not null unique;

alter table public.clinics
  add column slug text not null unique;
