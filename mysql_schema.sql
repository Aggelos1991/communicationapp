-- =====================================================
-- INVOICE TRACKER - MySQL 8.0 Schema
-- Complete translation from Supabase/Postgres
-- =====================================================
--
-- Business Logic:
-- - Multi-workflow invoice tracking (MISSING_INVOICE, PO_PENDING)
-- - Evidence collection (notes/emails) per invoice stage
-- - Payment validation workflow
-- - File attachment management
-- - User role-based access (enforced at application level)
--
-- Authentication: Application-managed (not database)
-- Access Control: Application-enforced (no RLS)
-- Storage Engine: InnoDB
-- Character Set: utf8mb4
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;

-- Drop existing objects (for clean reinstall)
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS payment_validations;
DROP TABLE IF EXISTS evidence;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;
DROP VIEW IF EXISTS invoices_with_metadata;

-- =====================================================
-- USERS TABLE (replaces auth.users)
-- =====================================================
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID format',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt/argon2 hash',
  email_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,

  INDEX idx_users_email (email),
  INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Application users - auth managed by backend';

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY COMMENT 'References users.id',
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL COMMENT 'Staff, Reconciliation Specialist, AP Specialist, Finance Manager, etc.',
  totp_secret VARCHAR(255) NULL COMMENT 'Base32 encoded TOTP secret for 2FA',
  totp_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_profiles_email (email),
  INDEX idx_profiles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User profile and role information';

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE invoices (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID format',
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  vendor VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NULL COMMENT 'Invoice amount',
  currency VARCHAR(3) DEFAULT 'EUR',
  entity VARCHAR(255) NULL COMMENT 'Business entity',
  po_creator VARCHAR(255) NULL COMMENT 'PO creator name',
  sharepoint_url TEXT NULL,

  -- Workflow configuration
  flow_type VARCHAR(20) NOT NULL COMMENT 'MISSING_INVOICE or PO_PENDING',
  current_stage VARCHAR(50) NOT NULL COMMENT 'Current workflow stage',
  source VARCHAR(20) DEFAULT 'MANUAL' COMMENT 'MANUAL, EXCEL, or RECON',
  status_detail VARCHAR(20) DEFAULT 'NONE' COMMENT 'WITHOUT PO, EXR PENDING, or NONE',
  payment_status VARCHAR(20) DEFAULT 'NONE' COMMENT 'NONE, REQUESTED, or PAID',

  -- Timestamps
  submission_timestamp TIMESTAMP NULL COMMENT 'When invoice was submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Audit trail
  created_by VARCHAR(255) NOT NULL COMMENT 'Creator name (denormalized)',
  created_by_role VARCHAR(100) NOT NULL COMMENT 'Creator role at creation time',
  created_by_id CHAR(36) NULL COMMENT 'Creator user ID',

  -- Constraints
  CONSTRAINT chk_flow_type CHECK (flow_type IN ('MISSING_INVOICE', 'PO_PENDING')),
  CONSTRAINT chk_source CHECK (source IN ('MANUAL', 'EXCEL', 'RECON')),
  CONSTRAINT chk_status_detail CHECK (status_detail IN ('WITHOUT PO', 'EXR PENDING', 'NONE')),
  CONSTRAINT chk_payment_status CHECK (payment_status IN ('NONE', 'REQUESTED', 'PAID')),

  -- Stage validation per flow type
  CONSTRAINT chk_missing_invoice_stage CHECK (
    flow_type != 'MISSING_INVOICE' OR
    current_stage IN ('Invoice Missing', 'Sent to AP Processing', 'PO Created', 'Posted', 'Closed')
  ),
  CONSTRAINT chk_po_pending_stage CHECK (
    flow_type != 'PO_PENDING' OR
    current_stage IN ('Invoice Received', 'PO Email Sent', 'PO Created', 'EXR Created', 'Closed')
  ),

  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_invoices_flow_type (flow_type),
  INDEX idx_invoices_current_stage (current_stage),
  INDEX idx_invoices_payment_status (payment_status),
  INDEX idx_invoices_vendor (vendor),
  INDEX idx_invoices_created_at (created_at DESC),
  INDEX idx_invoices_created_by_id (created_by_id),
  INDEX idx_invoices_invoice_number (invoice_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Core invoice tracking with workflow stages';

-- =====================================================
-- EVIDENCE TABLE
-- =====================================================
CREATE TABLE evidence (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID format',
  invoice_id CHAR(36) NOT NULL,
  type VARCHAR(10) NOT NULL COMMENT 'NOTE or EMAIL',
  content TEXT NOT NULL,
  stage_added_at VARCHAR(50) NOT NULL COMMENT 'Stage when evidence was added',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL COMMENT 'Evidence creator name',
  created_by_id CHAR(36) NULL COMMENT 'Evidence creator user ID',

  CONSTRAINT chk_evidence_type CHECK (type IN ('NOTE', 'EMAIL')),

  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_evidence_invoice_id (invoice_id),
  INDEX idx_evidence_created_at (created_at DESC),
  INDEX idx_evidence_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Evidence (notes/emails) collected during invoice workflow';

-- =====================================================
-- PAYMENT VALIDATIONS TABLE
-- =====================================================
CREATE TABLE payment_validations (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID format',
  invoice_id CHAR(36) NOT NULL UNIQUE COMMENT 'One validation per invoice',
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_by VARCHAR(255) NOT NULL COMMENT 'Validator name',
  validated_by_id CHAR(36) NULL COMMENT 'Validator user ID',
  comments TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_payment_validations_invoice_id (invoice_id),
  INDEX idx_payment_validations_validated_at (validated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Payment validation records (one per invoice)';

-- =====================================================
-- ATTACHMENTS TABLE
-- =====================================================
CREATE TABLE attachments (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID format',
  evidence_id CHAR(36) NULL COMMENT 'Parent evidence (if attached to evidence)',
  payment_validation_id CHAR(36) NULL COMMENT 'Parent payment validation (if attached to validation)',
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL COMMENT 'Storage URL (S3, local filesystem, etc.)',
  type VARCHAR(10) NOT NULL COMMENT 'IMAGE, PDF, EXCEL, or OTHER',
  size BIGINT NOT NULL COMMENT 'File size in bytes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_attachment_type CHECK (type IN ('IMAGE', 'PDF', 'EXCEL', 'OTHER')),

  -- Polymorphic parent: must have exactly one parent
  CONSTRAINT chk_attachments_parent CHECK (
    (evidence_id IS NOT NULL AND payment_validation_id IS NULL) OR
    (evidence_id IS NULL AND payment_validation_id IS NOT NULL)
  ),

  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_validation_id) REFERENCES payment_validations(id) ON DELETE CASCADE,

  INDEX idx_attachments_evidence_id (evidence_id),
  INDEX idx_attachments_payment_validation_id (payment_validation_id),
  INDEX idx_attachments_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='File attachments for evidence or payment validations';

-- =====================================================
-- VIEW: INVOICES WITH METADATA
-- =====================================================
-- Aggregates invoice data with counts and related info
-- Note: No security_invoker needed (no RLS in MySQL)
CREATE OR REPLACE VIEW invoices_with_metadata AS
SELECT
  i.id,
  i.invoice_number,
  i.vendor,
  i.amount,
  i.currency,
  i.entity,
  i.po_creator,
  i.sharepoint_url,
  i.flow_type,
  i.current_stage,
  i.source,
  i.status_detail,
  i.submission_timestamp,
  i.payment_status,
  i.created_at,
  i.updated_at,
  i.created_by,
  i.created_by_role,
  i.created_by_id,
  COUNT(DISTINCT e.id) as evidence_count,
  COUNT(DISTINCT a.id) as attachment_count,
  p.name as created_by_name,
  pv.validated_at as payment_validated_at,
  pv.validated_by as payment_validated_by
FROM invoices i
LEFT JOIN evidence e ON i.id = e.invoice_id
LEFT JOIN attachments a ON e.id = a.evidence_id
LEFT JOIN profiles p ON i.created_by_id = p.id
LEFT JOIN payment_validations pv ON i.id = pv.invoice_id
GROUP BY
  i.id, i.invoice_number, i.vendor, i.amount, i.currency, i.entity,
  i.po_creator, i.sharepoint_url, i.flow_type, i.current_stage,
  i.source, i.status_detail, i.submission_timestamp, i.payment_status,
  i.created_at, i.updated_at, i.created_by, i.created_by_role, i.created_by_id,
  p.name, pv.validated_at, pv.validated_by;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment to insert sample user and profile
/*
INSERT INTO users (id, email, password_hash, email_confirmed) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@example.com', '$2y$10$placeholder_hash_replace_with_real', TRUE);

INSERT INTO profiles (id, email, name, role, totp_enabled) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@example.com', 'System Admin', 'Finance Manager', FALSE);
*/

-- =====================================================
-- NOTES FOR APPLICATION DEVELOPERS
-- =====================================================
--
-- AUTH & ACCESS CONTROL:
-- - Authentication: Implement JWT/session-based auth in backend
-- - Password hashing: Use bcrypt (cost 12) or Argon2id
-- - UUID generation: Generate UUIDs in application (e.g., uuid.v4() in Node.js)
-- - Access control: Implement role-based permissions in application layer
--   * Staff: Read invoices
--   * Reconciliation: Create/edit MISSING_INVOICE flow
--   * AP: Edit PO_PENDING flow + sent-to-AP invoices
--   * Finance: Payment validation
--
-- REPLACED POSTGRES FEATURES:
-- - RLS policies → Implement in backend (e.g., WHERE created_by_id = :userId)
-- - auth.uid() → Pass current user ID from session/JWT
-- - handle_new_user() trigger → Call in user registration handler
-- - get_invoices_by_team_view() function → Implement as backend query method
--
-- TEAM VIEW FILTERING (replaces get_invoices_by_team_view function):
-- - RECON team: WHERE flow_type = 'MISSING_INVOICE'
-- - AP team: WHERE (flow_type = 'MISSING_INVOICE' AND current_stage = 'Sent to AP Processing')
--            OR flow_type = 'PO_PENDING'
-- - PAYMENT team: WHERE payment_status IN ('REQUESTED', 'PAID')
--
-- WORKFLOW STAGE TRANSITIONS:
-- Validate stage transitions in application:
-- - MISSING_INVOICE: Invoice Missing → Sent to AP Processing → PO Created → Posted → Closed
-- - PO_PENDING: Invoice Received → PO Email Sent → PO Created → EXR Created → Closed
--
-- FILE STORAGE:
-- - Store file metadata in attachments table
-- - Store actual files in S3/local filesystem
-- - attachments.url should contain the retrieval path
--
-- TIMEZONE HANDLING:
-- - MySQL TIMESTAMP is timezone-naive
-- - Store all times in UTC
-- - Convert to user timezone in application layer
--
-- =====================================================
