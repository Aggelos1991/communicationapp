-- Migration: Add "Sent to AP Processing" stage
-- Run this on the production database

-- Drop and recreate the MISSING_INVOICE stage constraint with the new stage
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_missing_invoice_stage;

ALTER TABLE invoices ADD CONSTRAINT chk_missing_invoice_stage CHECK (
  flow_type != 'MISSING_INVOICE' OR
  current_stage IN ('Invoice Missing', 'Sent to Vendor', 'Sent to AP Processing', 'PO Pending', 'PO Created', 'Posted', 'Closed')
);

-- Verify the constraint
-- SELECT flow_type, current_stage, COUNT(*) FROM invoices WHERE flow_type = 'MISSING_INVOICE' GROUP BY flow_type, current_stage;
