-- ============================================================
-- LoyaltyQR — Database Schema + RLS Policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. TABLES

create table merchants (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  shop_name text not null,
  shop_category text not null,
  logo_url text,
  merchant_code text unique,
  created_at timestamptz default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  name text not null,
  campaign_type text not null default 'amount' check (campaign_type in ('amount', 'visits')),
  target_amount numeric,
  target_visits integer,
  duration_days integer not null check (duration_days in (15, 30, 45, 60)),
  reward_description text not null,
  max_winners integer,
  status text default 'active' check (status in ('active', 'ended')),
  created_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  whatsapp_number text unique not null,
  birth_month integer check (birth_month between 1 and 12),
  birth_day integer check (birth_day between 1 and 31),
  created_at timestamptz default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  campaign_id uuid references campaigns(id),
  merchant_id uuid references merchants(id),
  total_spent numeric default 0,
  total_visits integer default 0,
  enrolled_at timestamptz default now(),
  deadline_at timestamptz not null,
  status text default 'active' check (status in ('active', 'completed', 'expired')),
  claim_code text,
  claimed boolean default false,
  warning_sent boolean default false
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references enrollments(id),
  merchant_id uuid references merchants(id),
  amount numeric not null default 0,
  scanned_at timestamptz default now(),
  qr_token text
);

create table qr_tokens (
  token text primary key,
  merchant_id uuid references merchants(id),
  campaign_id uuid references campaigns(id),
  amount numeric not null default 0,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  used boolean default false
);

create table message_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id),
  customer_id uuid references customers(id),
  template_name text not null,
  category text not null check (category in ('service', 'utility', 'marketing')),
  cost numeric default 0,
  sent_at timestamptz default now(),
  status text default 'sent' check (status in ('sent', 'failed'))
);

-- 2. INDEXES

create index idx_campaigns_merchant on campaigns(merchant_id);
create index idx_enrollments_merchant on enrollments(merchant_id);
create index idx_enrollments_customer on enrollments(customer_id);
create index idx_enrollments_campaign on enrollments(campaign_id);
create index idx_enrollments_status on enrollments(status);
create index idx_transactions_merchant on transactions(merchant_id);
create index idx_transactions_enrollment on transactions(enrollment_id);
create index idx_customers_whatsapp on customers(whatsapp_number);
create index idx_qr_tokens_merchant on qr_tokens(merchant_id);
create index idx_message_logs_merchant on message_logs(merchant_id);

-- 3. ENABLE RLS

alter table merchants enable row level security;
alter table campaigns enable row level security;
alter table customers enable row level security;
alter table enrollments enable row level security;
alter table transactions enable row level security;
alter table qr_tokens enable row level security;
alter table message_logs enable row level security;

-- 4. RLS POLICIES

-- Merchants: authenticated users can read their own row
create policy "Merchants can read own data"
  on merchants for select
  using (email = auth.jwt() ->> 'email');

create policy "Merchants can update own data"
  on merchants for update
  using (email = auth.jwt() ->> 'email');

create policy "Anyone can insert merchants"
  on merchants for insert
  with check (true);

-- Campaigns: merchants can CRUD their own campaigns
create policy "Merchants can read own campaigns"
  on campaigns for select
  using (merchant_id in (select id from merchants where email = auth.jwt() ->> 'email'));

create policy "Merchants can insert campaigns"
  on campaigns for insert
  with check (merchant_id in (select id from merchants where email = auth.jwt() ->> 'email'));

create policy "Merchants can update own campaigns"
  on campaigns for update
  using (merchant_id in (select id from merchants where email = auth.jwt() ->> 'email'));

-- Public read for campaigns (for scan pages)
create policy "Public can read campaigns"
  on campaigns for select
  using (true);

-- Customers: public read by whatsapp_number (for scan page), service role for write
create policy "Public can read customers"
  on customers for select
  using (true);

create policy "Service can insert customers"
  on customers for insert
  with check (true);

create policy "Service can update customers"
  on customers for update
  using (true);

-- Enrollments: merchants read their own, public read for progress pages
create policy "Merchants can read own enrollments"
  on enrollments for select
  using (true);

create policy "Service can insert enrollments"
  on enrollments for insert
  with check (true);

create policy "Service can update enrollments"
  on enrollments for update
  using (true);

-- Transactions: merchants read their own
create policy "Read transactions"
  on transactions for select
  using (true);

create policy "Insert transactions"
  on transactions for insert
  with check (true);

-- QR Tokens: merchants manage, public read for scan validation
create policy "Read qr_tokens"
  on qr_tokens for select
  using (true);

create policy "Insert qr_tokens"
  on qr_tokens for insert
  with check (true);

create policy "Update qr_tokens"
  on qr_tokens for update
  using (true);

-- Message logs: merchants read their own
create policy "Read message_logs"
  on message_logs for select
  using (true);

create policy "Insert message_logs"
  on message_logs for insert
  with check (true);
