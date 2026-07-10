-- ==============================================================================
-- Migration V8: Rolling Window for Milestone Campaigns
-- ==============================================================================

-- 1. Add window_mode and window_duration_days to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS window_mode text NOT NULL DEFAULT 'fixed' CHECK (window_mode IN ('fixed', 'rolling')),
ADD COLUMN IF NOT EXISTS window_duration_days integer;

-- 2. Relax duration_days constraint
-- Current constraint allows only 15, 30, 45, 60. We change it to just > 0.
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_duration_days_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_duration_days_positive CHECK (duration_days > 0);

-- 3. Add config_snapshot to enrollments for grandfathering
ALTER TABLE enrollments 
ADD COLUMN IF NOT EXISTS config_snapshot jsonb;
