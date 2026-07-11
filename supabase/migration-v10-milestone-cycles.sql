-- ==============================================================================
-- Migration V10: Milestone Cycle Rollover
-- ==============================================================================

-- 1. Add cycle_number to enrollments
ALTER TABLE enrollments 
ADD COLUMN IF NOT EXISTS cycle_number integer NOT NULL DEFAULT 1;

-- 2. Retroactively assign incremental cycle_number to customers with multiple enrollments for the same campaign
WITH numbered_enrollments AS (
  SELECT 
    id,
    ROW_NUMBER() OVER(PARTITION BY customer_id, campaign_id, merchant_id ORDER BY enrolled_at ASC) as cycle_seq
  FROM enrollments
)
UPDATE enrollments
SET cycle_number = numbered_enrollments.cycle_seq
FROM numbered_enrollments
WHERE enrollments.id = numbered_enrollments.id;
