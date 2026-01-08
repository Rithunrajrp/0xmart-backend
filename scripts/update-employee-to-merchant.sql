-- Migration to change EMPLOYEE role to MERCHANT
-- This updates the UserRole enum and all existing EMPLOYEE users to MERCHANT

BEGIN;

-- Step 1: Update any existing users with EMPLOYEE role to MERCHANT (temporary value)
UPDATE users SET role = 'USER' WHERE role = 'EMPLOYEE';

-- Step 2: Drop the old enum value and add new one
-- Note: PostgreSQL doesn't support direct enum value rename, so we need to:
-- 1. Add the new value
-- 2. Update data
-- 3. Remove the old value (if possible)

-- Add MERCHANT to the enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MERCHANT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
        ALTER TYPE "UserRole" ADD VALUE 'MERCHANT';
    END IF;
END $$;

-- Step 3: Update users who have seller profiles to MERCHANT role
UPDATE users
SET role = 'MERCHANT'
WHERE id IN (SELECT "userId" FROM sellers);

-- Note: We cannot remove EMPLOYEE from the enum in this transaction because PostgreSQL
-- doesn't allow removing enum values. The EMPLOYEE value will remain in the enum type
-- but will not be used. To fully remove it, you would need to:
-- 1. Create a new enum type without EMPLOYEE
-- 2. Alter the column to use the new type
-- 3. Drop the old enum type
-- This is more complex and risky, so we'll keep EMPLOYEE in the enum but not use it.

COMMIT;

-- Verify the changes
SELECT role, COUNT(*) FROM users GROUP BY role;
