-- BRITUME V6 launch foundation: usage ledger and subscription state.
-- Apply in Supabase SQL Editor after the V3 chat-history migration.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('chat','research','transcription','image')),
  request_id text,
  input_units integer not null default 0 check (input_units >= 0),
  output_units integer not null default 0 check (output_units >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_created_idx on public.usage_events(user_id, created_at desc);
alter table public.usage_events enable row level security;
drop policy if exists "Users can read own usage" on public.usage_events;
create policy "Users can read own usage" on public.usage_events for select using (auth.uid() = user_id);
-- Inserts are intentionally server-controlled; do not add a client INSERT policy.
create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','plus','pro')),
  status text not null default 'inactive' check (status in ('inactive','trialing','active','past_due','cancelled')),
  provider text check (provider in ('stripe','other')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_subscriptions enable row level security;
drop policy if exists "Users can read own subscription" on public.user_subscriptions;
create policy "Users can read own subscription" on public.user_subscriptions for select using (auth.uid() = user_id);
-- Subscription writes must be performed by a trusted server/webhook using a service role.
