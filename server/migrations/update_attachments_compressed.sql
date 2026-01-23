-- Migration: Update attachments to compressed storage format
-- Date: 2025-01-22
-- Description: Changes attachment storage from URL links to compressed base64 data

-- Update invoices table: rename block_email_link to block_attachment
ALTER TABLE invoices
  DROP COLUMN IF EXISTS block_email_link;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS block_attachment LONGTEXT NULL COMMENT 'JSON compressed attachment for block evidence';

-- Update attachments table: change from URL to compressed data storage
ALTER TABLE attachments
  DROP COLUMN IF EXISTS url,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS size;

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS data LONGTEXT NULL COMMENT 'JSON compressed attachment data (base64 gzip)';

-- Note: LONGTEXT can store up to 4GB which is plenty for compressed files
-- Evidence attachments are now stored as JSON array in the evidence.content or a separate JSON column

-- Add index for performance on blocked invoices
CREATE INDEX IF NOT EXISTS idx_invoices_payment_blocked ON invoices(payment_blocked);
