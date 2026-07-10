-- ==============================================================================
-- Migration V9: Points Expiry Configuration
-- ==============================================================================

-- 1. Add expiry_months to points_config
ALTER TABLE points_config 
ADD COLUMN IF NOT EXISTS expiry_months integer;

-- 2. Add warning_sent to points_ledger to track 3-day expiry warnings
ALTER TABLE points_ledger 
ADD COLUMN IF NOT EXISTS warning_sent boolean DEFAULT false NOT NULL;

-- 3. Create view for latest points balances
CREATE OR REPLACE VIEW current_points_balances AS
SELECT DISTINCT ON (merchant_id, customer_id)
  id as ledger_id,
  merchant_id,
  customer_id,
  balance_after as balance,
  warning_sent,
  created_at as last_activity_at
FROM points_ledger
ORDER BY merchant_id, customer_id, created_at DESC;
