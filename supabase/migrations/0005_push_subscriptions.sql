-- Web Push subscriptions (browser Push API), keyed by the subscription's own
-- unique endpoint URL rather than one-row-per-user — a user can have several
-- (one per browser/device) and each must be individually revocable when the
-- push service reports it as expired/invalid. Additive migration — 0001
-- already shipped conceptually, don't edit it in place.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Defense-in-depth only (see 0001_init.sql's RLS note) — the API is the
-- primary enforcement path and always scopes by the authenticated user's id.
create policy "push_subscriptions_own"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
