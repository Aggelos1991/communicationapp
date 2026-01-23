export enum FlowType {
  MISSING_INVOICE = 'MISSING_INVOICE',
  PO_PENDING = 'PO_PENDING',
}

export enum FlowStage {
  CLOSED = 'Closed',
  MISSING_INVOICE_MISSING = 'Invoice Missing',
  MISSING_INVOICE_SENT_TO_AP = 'Sent to AP Processing',
  MISSING_INVOICE_SENT_TO_VENDOR = 'Sent to Vendor',
  MISSING_INVOICE_PO_PENDING = 'PO Pending',
  MISSING_INVOICE_PO_CREATED = 'PO Created',
  MISSING_INVOICE_POSTED = 'Posted',
  PO_PENDING_RECEIVED = 'Invoice Received',
  PO_PENDING_SENT = 'PO Email Sent',
  PO_PENDING_CREATED = 'PO Created',
  PO_PENDING_EXR_CREATED = 'EXR Created',
}

export type TeamView = 'ALL' | 'RECON' | 'AP' | 'PAYMENT';
export type PaymentStatus = 'NONE' | 'REQUESTED' | 'PAID';
export type InvoiceSource = 'MANUAL' | 'EXCEL' | 'RECON';

// ReconRaptor session - stores source files once, links to multiple invoices
export interface ReconSession {
  id: string;
  createdAt: string;
  createdBy: string;
  vendorName: string;           // Vendor being reconciled
  erpFileName: string;          // Original ERP file name
  vendorFileName: string;       // Original vendor statement file name
  erpFileData: string;          // Compressed base64 data
  vendorFileData: string;       // Compressed base64 data
  matchedCount: number;         // Stats
  missingInErpCount: number;
  missingInVendorCount: number;
  importedCount: number;        // How many were sent to queue
}
export type StatusDetail = 'WITHOUT PO' | 'EXR PENDING' | 'NONE';

// Compressed file attachments - stored as gzip + base64 in DB to minimize storage
export interface Attachment {
  id: string;
  name: string;           // Original filename
  mimeType: string;       // File MIME type
  data: string;           // Compressed base64 data (gzip)
  originalSize: number;   // Original file size in bytes
  compressedSize: number; // Compressed size in bytes
}

export interface Evidence {
  id: string;
  type: 'NOTE' | 'EMAIL';
  content: string; 
  attachments?: Attachment[];
  createdAt: string;
  createdBy: string;
  stageAddedAt: FlowStage;
}

export interface Invoice {
  id: string;
  entity?: string;
  invoiceNumber: string;
  vendor: string;
  amount?: number;
  currency?: string;
  poCreator?: string;
  sharepointUrl?: string;
  statusDetail: StatusDetail;
  submissionTimestamp: string; // Automatic system timestamp
  flowType: FlowType;
  currentStage: FlowStage;
  source: InvoiceSource;
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // User email who created the entry
  createdByRole?: string; // User role who created the entry
  reconSessionId?: string; // Link to ReconRaptor session for traceback
  evidence: Evidence[];
  paymentStatus: PaymentStatus;
  paymentBlocked: boolean; // Flag for blocking payment in Reconciliation
  blockReason?: string; // Text note explaining why blocked
  blockAttachment?: Attachment; // Compressed file attachment for block evidence
  paymentValidation?: {
    validatedAt: string;
    validatedBy: string;
    comments: string;
    attachments?: Attachment[];
  };
}