-- Migration: Add payment_blocked column and update stage constraint
-- Run this on the production database

-- Add payment_blocked column if it doesn't exist
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_blocked BOOLEAN DEFAULT FALSE COMMENT 'Flag for blocking payment in Reconciliation';

-- Drop and recreate the MISSING_INVOICE stage constraint to include "Sent to Vendor"
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_missing_invoice_stage;

ALTER TABLE invoices ADD CONSTRAINT chk_missing_invoice_stage CHECK (
  flow_type != 'MISSING_INVOICE' OR
  current_stage IN ('Invoice Missing', 'Sent to AP Processing', 'Sent to Vendor', 'PO Created', 'Posted', 'Closed')
);

-- Verify the column was added
-- SELECT * FROM information_schema.COLUMNS WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_blocked';
