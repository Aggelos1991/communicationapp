export enum FlowType {
  MISSING_INVOICE = 'MISSING_INVOICE',
  PO_PENDING = 'PO_PENDING',
}

export enum FlowStage {
  CLOSED = 'Closed',
  MISSING_INVOICE_MISSING = 'Invoice Missing',
  MISSING_INVOICE_SENT_TO_AP = 'Sent to AP Processing',
  MISSING_INVOICE_SENT_TO_VENDOR = 'Sent to Vendor',
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
export type StatusDetail = 'WITHOUT PO' | 'EXR PENDING' | 'NONE';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'IMAGE' | 'PDF' | 'EXCEL' | 'OTHER';
  size: number;
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
  evidence: Evidence[];
  paymentStatus: PaymentStatus;
  paymentBlocked: boolean; // Flag for blocking payment in Reconciliation
  paymentValidation?: {
    validatedAt: string;
    validatedBy: string;
    comments: string;
    attachments?: Attachment[];
  };
}