-- ============================================================
-- LoyaltyQR — Database Migration V7
-- Digital Points (Cashback) System
-- Adds loyalty_mechanism to merchants, points_config, points_ledger
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. ADD loyalty_mechanism TO MERCHANTS
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS loyalty_mechanism text NOT NULL DEFAULT 'milestone';

ALTER TABLE merchants
  DROP CONSTRAINT IF EXISTS merchants_loyalty_mechanism_check;

ALTER TABLE merchants
  ADD CONSTRAINT merchants_loyalty_mechanism_check
  CHECK (loyalty_mechanism IN ('milestone', 'points'));

-- 2. POINTS CONFIG TABLE — one row per merchant
CREATE TABLE IF NOT EXISTS points_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  cashback_percentage numeric NOT NULL DEFAULT 5,
  conversion_rate numeric NOT NULL DEFAULT 1,
  min_bill_amount numeric DEFAULT 0,
  min_redeem_points numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. POINTS LEDGER TABLE — append-only transaction log
CREATE TABLE IF NOT EXISTS points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
  points numeric NOT NULL,
  bill_amount numeric,
  cashback_pct_at_time numeric,
  conversion_rate_at_time numeric,
  balance_after numeric NOT NULL,
  qr_token text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_points_config_merchant ON points_config(merchant_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_merchant_customer ON points_ledger(merchant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_created ON points_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_points_ledger_type ON points_ledger(type);
CREATE INDEX IF NOT EXISTS idx_merchants_loyalty_mechanism ON merchants(loyalty_mechanism);

-- 5. ENABLE RLS
ALTER TABLE points_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES — points_config
-- Merchants can read their own config
CREATE POLICY "Merchants can read own points_config"
  ON points_config FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE email = auth.jwt() ->> 'email'));

-- Deny direct client insert/update — handled by service role API
CREATE POLICY "Service role insert points_config"
  ON points_config FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Service role update points_config"
  ON points_config FOR UPDATE
  USING (false);

-- 7. RLS POLICIES — points_ledger
-- Merchants can read their own ledger entries
CREATE POLICY "Merchants can read own points_ledger"
  ON points_ledger FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE email = auth.jwt() ->> 'email'));

-- Deny direct client insert — handled by service role API
CREATE POLICY "Service role insert points_ledger"
  ON points_ledger FOR INSERT
  WITH CHECK (false);

-- 8. MAKE campaign_id NULLABLE on qr_tokens for points merchants
-- Points merchants don't have campaigns, so QR tokens need campaign_id to be nullable
ALTER TABLE qr_tokens ALTER COLUMN campaign_id DROP NOT NULL;
