-- Expo push tokens (React Native app), separate from push_subscriptions
-- (0005) which is Web Push/VAPID-specific (endpoint+keys shape). An Expo
-- push token is a single opaque string routed through Expo's own push
-- service to APNs/FCM — a different transport entirely, so it gets its own
-- table rather than overloading push_subscriptions' columns. A user can
-- have several (one per device), same one-row-per-device model as
-- push_subscriptions, individually revocable when Expo reports a token as
-- no longer registered.

create table expo_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
create index expo_push_tokens_user_idx on expo_push_tokens (user_id);

alter table expo_push_tokens enable row level security;

-- Defense-in-depth only (see 0001_init.sql's RLS note) — the API is the
-- primary enforcement path and always scopes by the authenticated user's id.
create policy "expo_push_tokens_own"
  on expo_push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
