-- Migration: Update PO Created stages to unique values
-- This migration fixes the duplicate "PO Created" stage name issue
-- by renaming them to unique values: "Recon PO Created" and "AP PO Created"
-- Run this on the production database

-- First, update existing records based on their flow_type
-- For MISSING_INVOICE flow: "PO Created" -> "Recon PO Created"
UPDATE invoices
SET current_stage = 'Recon PO Created'
WHERE flow_type = 'MISSING_INVOICE' AND current_stage = 'PO Created';

-- For PO_PENDING flow: "PO Created" -> "AP PO Created"
UPDATE invoices
SET current_stage = 'AP PO Created'
WHERE flow_type = 'PO_PENDING' AND current_stage = 'PO Created';

-- Update evidence records that reference the old stage
UPDATE evidence
SET stage_added_at = 'Recon PO Created'
WHERE stage_added_at = 'PO Created'
AND invoice_id IN (SELECT id FROM invoices WHERE flow_type = 'MISSING_INVOICE');

UPDATE evidence
SET stage_added_at = 'AP PO Created'
WHERE stage_added_at = 'PO Created'
AND invoice_id IN (SELECT id FROM invoices WHERE flow_type = 'PO_PENDING');

-- Drop and recreate the MISSING_INVOICE stage constraint with new values
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_missing_invoice_stage;

ALTER TABLE invoices ADD CONSTRAINT chk_missing_invoice_stage CHECK (
  flow_type != 'MISSING_INVOICE' OR
  current_stage IN ('Invoice Missing', 'Sent to AP Processing', 'Sent to Vendor', 'PO Pending', 'Recon PO Created', 'Posted', 'Closed')
);

-- Drop and recreate the PO_PENDING stage constraint with new values
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_po_pending_stage;

ALTER TABLE invoices ADD CONSTRAINT chk_po_pending_stage CHECK (
  flow_type != 'PO_PENDING' OR
  current_stage IN ('Invoice Received', 'PO Email Sent', 'AP PO Created', 'EXR Created', 'Closed')
);

-- Verify the updates
-- SELECT flow_type, current_stage, COUNT(*) FROM invoices GROUP BY flow_type, current_stage;
