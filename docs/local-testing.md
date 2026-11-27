# Testing locally

Run the whole app on your machine against a local database, with demo
accounts and a queue for today. Nothing touches staging, and no SMS,
WhatsApp, email or push message is sent.

## One-time setup

- Node 20+ and pnpm, then `pnpm install` from the repo root
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

Your `apps/api/.env` and `apps/web/.env.local` can stay pointed at staging.
`pnpm dev:local` overrides them for that run only.

## Start

Start Docker Desktop, wait until it says it's running, then from the repo root:

```bash
pnpm dev:local
```

This starts local Supabase if it isn't running (the first time downloads
images and takes a few minutes), loads the demo data, then runs the web app on
http://localhost:3000 and the API on http://127.0.0.1:3001. Ctrl+C stops the
apps. Supabase keeps running in Docker until you run `supabase stop`.

| Command | What it does |
| --- | --- |
| `pnpm dev:local` | Start everything; moves the demo queue to today |
| `pnpm dev:local --reset` | Wipe the local database back to the seed first |
| `pnpm dev:local --seed` | Only refresh the demo data (apps already running) |
| `supabase stop` | Stop the local database (data is kept) |

Studio, at http://127.0.0.1:54323, lets you look at and edit the local tables.

## Accounts

Sign in with the phone number; the code is always **123456**.

| Phone | Who | Where to start |
| --- | --- | --- |
| 0300 1234567 | Dr. Ayesha Khan, owner of two branches (Gulberg and DHA) | /clinic/khan-skin-clinic-gulberg/today |
| 0300 9876543 | Receptionist at Gulberg | /desk/khan-skin-clinic-gulberg |
| 0300 5556666 | Junior doctor at Gulberg, assigned two patients | /clinic/khan-skin-clinic-gulberg/today |
| 0300 1110000 | Platform admin | /admin/practitioners |
| 0300 7654321 | Patient, Bilal Ahmed | / |

Each start re-creates today's demo queue around the current time: a completed
visit, two checked in, a no-show and later bookings at Gulberg, plus two at DHA.
Anything you did to those demo appointments (vitals, notes) is cleared then.
Everything else you create stays until `--reset`.

To test inviting staff, sign in as the owner and invite **0300 6667777** from
Staff: it already accepts code 123456 and the demo doesn't use it. For more
numbers, add them with code 123456 under `[auth.sms.test_otp]` in
`supabase/config.toml`, then run `supabase stop` and `pnpm dev:local` so
Supabase picks them up.

## What to check

**Clinic workspace** (owner)
- Navy sidebar on the left; today's date under the clinic name at the top
- Branch switcher at the bottom of the sidebar: switching from Patients lands on DHA's Patients, and the queue changes
- Today: KPI cards, the queue, check in, record vitals, attach a report
- The junior doctor sees fewer menu items than the owner, and only their assigned patients

**Front desk** (receptionist, or owner via "Front desk" in the sidebar)
- Narrow icon rail: Queue, Patients, Clinic
- Check a patient in here, then open the clinic's Today page: it shows there too
- The junior doctor is refused at /desk/khan-skin-clinic-gulberg

**Admin** (0300 1110000)
- Verification and Reported reviews in the sidebar, with how many are waiting
- The patient opening /admin/practitioners gets the normal site header and an access message

**Patient** (0300 7654321)
- Same navy sidebar: My account, Find a doctor, appointments, family, records, notifications
- Top bar greets the patient by name with today's date
- Booking (Find a doctor → a doctor → a clinic) ends on a booking page inside the sidebar frame

**Partner portal:** /partner shows the frame and an overview. There are no partner accounts yet.

**UI kit:** /ui-kit has every shared component. Use Light / Dark at the top;
open the modal and drawer in dark too.

**Every screen, also:**
- Urdu from the language menu: everything flips right to left, sidebar on the right
- Phone width (browser dev tools, ~390px): sidebar becomes a strip across the top, no sideways scrolling

## Automated tests

With local Supabase running:

```bash
pnpm test                                   # unit tests, all apps
pnpm --filter @careconnect/api test:e2e     # API against the local database
pnpm build && pnpm lint && pnpm typecheck
```

The e2e tests use the same local database as `pnpm dev:local`. They create
their own users and don't depend on the demo data.

## When something goes wrong

- **"Docker isn't running"**: start Docker Desktop and wait for it to finish starting.
- **"Port 3000 is already in use"** or **"Another next dev server is already
  running"**: another `pnpm dev` is running. Stop it first (Next.js allows only
  one dev server per app). If something else needs those ports, pick others:
  `WEB_PORT=3100 API_PORT=3101 pnpm dev:local`.
- **"Invalid or expired token" after signing in**: the web app and API are
  talking to different databases, usually because they were started with plain
  `pnpm dev` (which uses the `.env` files, i.e. staging). Use `pnpm dev:local`.
- **Demo data fails to load after pulling new migrations**: `pnpm dev:local --reset`.
- **A test number says the code is wrong**: run `supabase stop`, then `pnpm dev:local`.
  Supabase only reads `config.toml` when it starts.
