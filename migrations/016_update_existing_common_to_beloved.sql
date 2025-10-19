-- ============================================================
-- UPDATE EXISTING RECORDS: Change 'common' to 'beloved'
-- ============================================================
-- This migration updates existing 'common' records to 'beloved'
-- Must be run after the enum value is added

-- Update existing 'common' records to 'beloved' in posts table
UPDATE posts SET tier = 'beloved' WHERE tier = 'common';

-- Note: We cannot remove 'common' from the enum in PostgreSQL
-- The old 'common' value will remain but won't be used in new records
-- This is a limitation of PostgreSQL enums - values can only be added, not removed
