# CareConnect — Mobile

The patient-facing half of CareConnect on Expo/React Native — directory search,
booking, family profiles, and the record vault, talking to the same NestJS API
(`apps/api`) and Supabase Auth as `apps/web`. Clinic-side (staff dashboards,
clinical notes, analytics) stays web-only; there's no reason a receptionist or
doctor needs those on a phone the way a patient needs booking on the go.

## Stack

- **Expo SDK 57** with **Expo Router** (file-based routing, `src/app/`) —
  screens under `(tabs)/` are the bottom-tab shell; `login`, `practitioner/[slug]`,
  and `book/[practitionerSlug]/[clinicId]` are pushed on top of it.
- **Supabase JS** (`@supabase/supabase-js`) for phone-OTP auth, same project as
  `apps/web` — `signInWithOtp`/`verifyOtp` directly, not through the NestJS API.
  Session persists to `AsyncStorage` on native; on web it falls back to
  supabase-js's own browser storage (see `src/lib/supabase.ts`'s doc comment
  for why the split matters — AsyncStorage's web shim needs `window`, which
  doesn't exist during `expo export`'s static prerender pass).
- **`@careconnect/shared-types`** / **`@careconnect/validation`** — the same
  domain enums and Zod schemas `apps/api` and `apps/web` use, imported
  directly as workspace packages. Metro auto-configures monorepo resolution
  on SDK 52+; no custom `metro.config.js` needed.
- Plain `StyleSheet` components, not NativeWind — `src/components/ui/` is a
  small hand-built kit (`Button`, `Card`, `TextField`, `Chip`) styled from
  `src/constants/theme.ts`, which ports the same "stamped document" brand
  palette as `packages/config/tailwind-preset.css` (apps/web's tokens). No
  light/dark switching — the web app doesn't have one either; it's one fixed
  brand identity.

## Setup

```bash
cd apps/mobile
cp .env.example .env    # fill in from apps/web/.env.local — same Supabase project
pnpm dev                # = expo start
```

`EXPO_PUBLIC_API_URL` needs care beyond `localhost`: that only reaches the API
from an iOS Simulator or the Expo web target running on the same machine — a
physical device (including Expo Go over Wi-Fi) needs this machine's LAN IP
instead (`http://192.168.x.x:3001`).

Local dev phone-OTP login uses the same seeded numbers as `apps/web` (see the
root README) — code `123456` for all of them.

## What's here vs. not yet

Built: phone-OTP auth, directory search + practitioner profiles (public, no
session needed), booking (slot picking, family-member selection, waitlist
fallback), appointments (list/cancel), family member management, the vault
(records, medical summary, visit history, upload from photo library, create/
revoke a second-opinion share link), account/sign-out.

Not built here: push notifications, native camera capture for vault uploads
(photo library only — `expo-image-picker`'s `launchImageLibraryAsync`, not
`launchCameraAsync`), reschedule (web has it; mobile only cancels), a real
share sheet for share links (currently surfaces the raw token/URL via an
alert — wiring up `expo-sharing`/the OS share sheet is a small follow-up, not
a redesign), and no EAS build/submit configuration — `pnpm build` here is a
placeholder, not a real native binary build. All genuinely buildable, none
blocking what exists.

## Scripts

- `pnpm dev` / `pnpm start` — `expo start` (scan the QR with Expo Go, or press
  `i`/`a`/`w` for a simulator/emulator/web)
- `pnpm lint` / `pnpm typecheck` — same as every other package in the monorepo
- `pnpm build` — not a real build yet (see above)
