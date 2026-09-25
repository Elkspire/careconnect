-- Human-readable specialty identifier for the public directory's
-- specialty-filter links — was a raw specialtyId UUID in the URL
-- (?specialtyId=aaaaaaaa-aaaa-...), which isn't something a person can
-- read or share. Nullable-then-backfill-then-NOT-NULL, unlike
-- 0004_slugs.sql's direct NOT NULL UNIQUE, since specialties (unlike
-- practitioners/clinics at that point) may already have rows before this
-- migration runs.

alter table public.specialties add column slug text;

update public.specialties
set slug = trim(both '-' from regexp_replace(lower(name_en), '[^a-z0-9]+', '-', 'g'))
where slug is null;

alter table public.specialties
  alter column slug set not null,
  add constraint specialties_slug_unique unique (slug);
