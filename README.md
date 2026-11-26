# CareConnect

Doctor appointment booking and medical-records platform for Pakistan. Product context lives in [resources/](resources/):

- [SCREENS.md](resources/SCREENS.md) — every screen across the five products, with what each one shows
- [prototypes/](resources/prototypes/) — clickable HTML prototypes, and the source of the web app's palette, type and global styles (see `packages/config/tailwind-preset.css`)
- one folder of screen PNGs per product, and [the system architecture diagram](resources/CareConnect-System-architecture.png)

## Stack

- **apps/web** — Next.js (patient directory/booking + clinic dashboard)
- **apps/api** — NestJS (REST API, Supabase-backed)
- **packages/shared-types** — domain enums + generated Supabase DB types
- **packages/validation** — Zod schemas, the single source of truth for request/response shapes shared by `apps/api` and `apps/web`
- **packages/config** — shared tsconfig bases and Tailwind design tokens
- **supabase/** — SQL migrations, RLS policies, and local dev seed data

## Setup

Requires Node 20+, pnpm, the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), and Docker (for the local Supabase stack).

```bash
pnpm install
supabase start        # boots local Postgres/Auth/Storage — requires Docker
supabase db reset      # applies supabase/migrations and supabase/seed/seed.sql
pnpm db:gen-types       # regenerate packages/shared-types/src/database.types.ts
pnpm dev                # runs apps/web and apps/api in watch mode
```

Local dev phone-OTP login: seeded numbers `+923001234567` (doctor), `+923007654321` (patient), `+923009876543` (receptionist) all accept OTP `123456` (see `supabase/config.toml`'s `[auth.sms.test_otp]`) — no real SMS provider needed locally.

## Scripts (from repo root, via Turborepo)

- `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across all apps/packages
- `pnpm db:gen-types` — regenerate Supabase TS types from the local schema

## Scope

v1 scope: single-city verified directory, in-clinic-only booking, patient accounts with family profiles and record upload, doctor accounts with an owner + receptionist role, WhatsApp/SMS/push notifications, Urdu + English. The prototypes in `resources/` go further (video consults, the front-desk queue, admin and partner portals) and show where the product is heading.
