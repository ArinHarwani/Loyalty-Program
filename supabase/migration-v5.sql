-- ============================================================
-- LoyaltyQR — Database Migration V5
-- New pricing tier system: Growth / Business / Pro
-- Adds customer_limit, duration_months, updates plan constraints
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. ADD customer_limit COLUMN TO MERCHANTS
alter table merchants add column if not exists customer_limit integer;

-- 2. ADD duration_months COLUMN TO SUBSCRIPTIONS
alter table subscriptions add column if not exists duration_months integer default 1;

-- ============================================================
-- 3. MIGRATE DATA FIRST (before adding new constraints)
-- ============================================================

-- Migrate existing starter merchants → growth
update merchants
  set subscription_plan = 'growth',
      customer_limit = 1000
  where subscription_plan = 'starter';

-- Set customer_limit for existing growth merchants
update merchants
  set customer_limit = 1000
  where subscription_plan = 'growth' and customer_limit is null;

-- Update plan_name in subscriptions table
update subscriptions
  set plan_name = 'growth'
  where plan_name = 'starter';

-- ============================================================
-- 4. NOW ADD CONSTRAINTS (data is already clean)
-- ============================================================

-- Update subscription_plan constraint on merchants
alter table merchants
  drop constraint if exists merchants_subscription_plan_check;

alter table merchants
  add constraint merchants_subscription_plan_check
  check (subscription_plan in ('growth', 'business', 'pro', 'custom'));

-- Update plan_name constraint on subscriptions
alter table subscriptions
  drop constraint if exists subscriptions_plan_name_check;

alter table subscriptions
  add constraint subscriptions_plan_name_check
  check (plan_name in ('growth', 'business', 'pro', 'custom'));

-- Update package_name constraint on merchant_packages (legacy table)
alter table merchant_packages
  drop constraint if exists merchant_packages_package_name_check;

alter table merchant_packages
  add constraint merchant_packages_package_name_check
  check (package_name in ('trial', 'starter', 'growth', 'business', 'pro', 'custom'));

-- Update status constraint on merchant_status_log
alter table merchant_status_log
  drop constraint if exists merchant_status_log_status_check;

alter table merchant_status_log
  add constraint merchant_status_log_status_check
  check (status in ('active', 'inactive', 'churned', 'trial', 'blocked'));

-- 5. INDEX on customer_limit for performance
create index if not exists idx_merchants_customer_limit on merchants(customer_limit);
