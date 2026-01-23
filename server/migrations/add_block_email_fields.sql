-- Add block email fields to invoices table
-- These fields store the reason for blocking and a link to the email sent to PO Owner
-- Using text links (URLs) instead of file storage to minimize database storage usage
-- (payment_blocked column already exists from previous migration)

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS block_reason TEXT COMMENT 'Text note explaining why payment is blocked';

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS block_email_link TEXT COMMENT 'Link to the email sent to PO Owner (Gmail/Outlook URL - minimal storage)';

-- Add index for faster querying of blocked invoices (MySQL syntax)
-- Note: MySQL doesn't support partial indexes, so we use a regular index
CREATE INDEX idx_invoices_payment_blocked ON invoices(payment_blocked);
