-- Migration: Rename admin role to super_admin
-- Run this migration before deploying the code changes

-- Update existing admin users to super_admin
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

-- Verify the migration
SELECT id, username, role FROM users WHERE role IN ('admin', 'super_admin');
