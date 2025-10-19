-- ============================================================
-- UPDATE TIER ENUM: Change 'common' to 'beloved'
-- ============================================================
-- This migration updates the tier_type enum to use 'beloved' instead of 'common'
-- for a more positive, inclusive branding

-- First, add the new 'beloved' value to the enum
ALTER TYPE tier_type ADD VALUE 'beloved';
