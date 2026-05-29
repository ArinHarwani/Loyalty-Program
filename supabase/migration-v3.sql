-- ============================================================
-- LoyaltyQR — Database Migration V3
-- Setup database-backed rate-limiting table and indexes
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. CREATE RATE LIMIT HITS TABLE
create table if not exists rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  key text not null, -- e.g. 'ip:/api/some-route' or 'customer:123'
  created_at timestamptz not null default now()
);

-- 2. CREATE PERFORMANCE INDEXES
create index if not exists idx_rate_limit_hits_key_created_at on rate_limit_hits(key, created_at);

-- 3. ENABLE RLS
alter table rate_limit_hits enable row level security;

-- 4. RLS POLICIES
-- Only allow select/insert/delete operations via Service Role (bypasses RLS)
-- No public user should have access to read or mutate rate limits directly.
create policy "Service role manage rate limits"
  on rate_limit_hits
  for all
  using (false)
  with check (false);
