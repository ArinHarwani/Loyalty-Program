-- ============================================================
-- LoyaltyQR — Database Migration V2
-- New tables for admin features + merchant tracking
-- Run this in Supabase SQL Editor AFTER the original migration
-- ============================================================

-- 1. NEW COLUMNS ON MERCHANTS
alter table merchants add column if not exists current_package text default 'trial';
alter table merchants add column if not exists status text default 'active';
alter table merchants add column if not exists last_login_at timestamptz;
alter table merchants add column if not exists notes text;

-- 2. MERCHANT PACKAGES TABLE
create table if not exists merchant_packages (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  package_name text not null check (package_name in ('trial', 'starter', 'growth')),
  price numeric not null default 0,
  started_at timestamptz default now(),
  ended_at timestamptz,
  is_current boolean default true,
  notes text
);

-- 3. MERCHANT STATUS LOG TABLE
create table if not exists merchant_status_log (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  status text not null check (status in ('active', 'inactive', 'churned', 'trial')),
  changed_at timestamptz default now(),
  reason text
);

-- 4. INDEXES
create index if not exists idx_merchant_packages_merchant on merchant_packages(merchant_id);
create index if not exists idx_merchant_status_log_merchant on merchant_status_log(merchant_id);
create index if not exists idx_merchants_status on merchants(status);

-- 5. RLS
alter table merchant_packages enable row level security;
alter table merchant_status_log enable row level security;

create policy "Read merchant_packages"
  on merchant_packages for select
  using (true);

create policy "Insert merchant_packages"
  on merchant_packages for insert
  with check (true);

create policy "Update merchant_packages"
  on merchant_packages for update
  using (true);

create policy "Read merchant_status_log"
  on merchant_status_log for select
  using (true);

create policy "Insert merchant_status_log"
  on merchant_status_log for insert
  with check (true);
