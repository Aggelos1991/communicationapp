export type FlowType = 'MISSING_INVOICE' | 'PO_PENDING';
export type InvoiceSource = 'MANUAL' | 'EXCEL' | 'RECON';
export type StatusDetail = 'WITHOUT PO' | 'EXR PENDING' | 'NONE';
export type PaymentStatus = 'NONE' | 'REQUESTED' | 'PAID';
export type EvidenceType = 'NOTE' | 'EMAIL';
// Attachments are now compressed (gzip) and stored as base64 in JSON columns
export type TeamView = 'RECON' | 'AP' | 'PAYMENT' | 'ALL';

// Workflow stages
export const MISSING_INVOICE_STAGES = [
  'Invoice Missing',
  'Sent to AP Processing',
  'Sent to Vendor',
  'PO Pending',
  'PO Created',
  'Posted',
  'Closed'
] as const;

export const PO_PENDING_STAGES = [
  'Invoice Received',
  'PO Email Sent',
  'PO Created',
  'EXR Created',
  'Closed'
] as const;

export type MissingInvoiceStage = typeof MISSING_INVOICE_STAGES[number];
export type PoPendingStage = typeof PO_PENDING_STAGES[number];

// Database entities
export interface User {
  id: string;
  email: string;
  password_hash: string;
  email_confirmed: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor: string;
  amount: number | null;
  currency: string;
  entity: string | null;
  po_creator: string | null;
  sharepoint_url: string | null;
  flow_type: FlowType;
  current_stage: string;
  source: InvoiceSource;
  status_detail: StatusDetail;
  submission_timestamp: Date | null;
  payment_status: PaymentStatus;
  payment_blocked: boolean;
  block_reason: string | null;
  block_attachment: string | null; // JSON string of compressed attachment
  created_at: Date;
  updated_at: Date;
  created_by: string;
  created_by_role: string;
  created_by_id: string | null;
}

export interface InvoiceWithMetadata extends Invoice {
  evidence_count: number;
  attachment_count: number;
  created_by_name: string | null;
  payment_validated_at: Date | null;
  payment_validated_by: string | null;
}

export interface Evidence {
  id: string;
  invoice_id: string;
  type: EvidenceType;
  content: string;
  stage_added_at: string;
  created_at: Date;
  created_by: string;
  created_by_id: string | null;
}

// Compressed attachment stored as JSON (gzip + base64)
export interface CompressedAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 encoded gzip compressed data
  originalSize: number;
  compressedSize: number;
}

// Legacy attachment table (for migration compatibility)
export interface Attachment {
  id: string;
  evidence_id: string | null;
  payment_validation_id: string | null;
  name: string;
  data: string | null; // JSON string of CompressedAttachment
  created_at: Date;
}

export interface PaymentValidation {
  id: string;
  invoice_id: string;
  validated_at: Date;
  validated_by: string;
  validated_by_id: string | null;
  comments: string | null;
  created_at: Date;
}

// Insert types (omit auto-generated fields)
export type UserInsert = Omit<User, 'created_at' | 'updated_at' | 'last_login_at'>;
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type InvoiceInsert = Omit<Invoice, 'created_at' | 'updated_at'>;
export type EvidenceInsert = Omit<Evidence, 'created_at'>;
export type AttachmentInsert = Omit<Attachment, 'created_at'>;
export type PaymentValidationInsert = Omit<PaymentValidation, 'validated_at' | 'created_at'>;
