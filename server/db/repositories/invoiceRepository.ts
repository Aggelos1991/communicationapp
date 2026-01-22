import pool from '../connection';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import type {
  Invoice,
  InvoiceWithMetadata,
  InvoiceInsert,
  FlowType,
  TeamView,
  MissingInvoiceStage,
  PoPendingStage
} from '../types';
import { MISSING_INVOICE_STAGES, PO_PENDING_STAGES } from '../types';

/**
 * Format date for MySQL timestamp
 */
function formatDateForMySQL(date: string | Date | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Validate workflow stage transition
 * Note: Backward transitions are allowed to support the "Revert" feature
 */
function validateStageTransition(
  flowType: FlowType,
  currentStage: string,
  newStage: string
): void {
  const stages = flowType === 'MISSING_INVOICE' ? MISSING_INVOICE_STAGES : PO_PENDING_STAGES;

  const newIndex = stages.indexOf(newStage as any);

  if (newIndex === -1) {
    throw new Error(`Invalid stage "${newStage}" for flow type ${flowType}`);
  }

  // Allow any valid stage transition (forward, backward, or same)
  // Backward transitions are needed for the "Revert to previous stage" feature
}

/**
 * Validate stage is valid for flow type
 */
function validateStageForFlowType(flowType: FlowType, stage: string): void {
  const validStages = flowType === 'MISSING_INVOICE' ? MISSING_INVOICE_STAGES : PO_PENDING_STAGES;

  if (!validStages.includes(stage as any)) {
    throw new Error(`Stage "${stage}" is not valid for flow type ${flowType}`);
  }
}

/**
 * Create invoice
 */
export async function createInvoice(
  invoice: InvoiceInsert,
  createdByUserId: string,
  createdByName: string,
  createdByRole: string
): Promise<Invoice> {
  const invoiceId = uuidv4();

  // Validate stage for flow type
  validateStageForFlowType(invoice.flow_type, invoice.current_stage);

  await pool.query(
    `INSERT INTO invoices (
      id, invoice_number, vendor, amount, currency, entity, po_creator,
      sharepoint_url, flow_type, current_stage, source, status_detail,
      submission_timestamp, payment_status, created_by, created_by_role, created_by_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId,
      invoice.invoice_number,
      invoice.vendor,
      invoice.amount,
      invoice.currency,
      invoice.entity || null,
      invoice.po_creator || null,
      invoice.sharepoint_url || null,
      invoice.flow_type,
      invoice.current_stage,
      invoice.source,
      invoice.status_detail,
      invoice.submission_timestamp ? formatDateForMySQL(invoice.submission_timestamp) : null,
      invoice.payment_status,
      createdByName,
      createdByRole,
      createdByUserId
    ]
  );

  const created = await getInvoiceById(invoiceId);
  if (!created) {
    throw new Error('Failed to create invoice');
  }

  return created;
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const [rows] = await pool.query<(Invoice & RowDataPacket)[]>(
    'SELECT * FROM invoices WHERE id = ?',
    [invoiceId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get invoice by invoice number
 */
export async function getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
  const [rows] = await pool.query<(Invoice & RowDataPacket)[]>(
    'SELECT * FROM invoices WHERE invoice_number = ?',
    [invoiceNumber]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update invoice stage (with workflow validation)
 */
export async function updateInvoiceStage(
  invoiceId: string,
  newStage: string
): Promise<Invoice> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Validate stage transition
  validateStageTransition(invoice.flow_type, invoice.current_stage, newStage);

  await pool.query(
    'UPDATE invoices SET current_stage = ? WHERE id = ?',
    [newStage, invoiceId]
  );

  const updated = await getInvoiceById(invoiceId);
  if (!updated) {
    throw new Error('Invoice not found after update');
  }

  return updated;
}

/**
 * Update invoice (general)
 */
export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'created_by_role' | 'created_by_id'>>
): Promise<Invoice> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // If updating stage, validate transition
  if (updates.current_stage && updates.current_stage !== invoice.current_stage) {
    validateStageTransition(invoice.flow_type, invoice.current_stage, updates.current_stage);
  }

  const fields: string[] = [];
  const values: any[] = [];

  const allowedFields: Array<keyof typeof updates> = [
    'vendor',
    'amount',
    'currency',
    'entity',
    'po_creator',
    'sharepoint_url',
    'current_stage',
    'status_detail',
    'payment_status',
    'submission_timestamp',
    'payment_blocked',
    'block_reason',
    'block_attachment'
  ];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  });

  if (fields.length === 0) {
    return invoice; // No changes
  }

  values.push(invoiceId);

  await pool.query(
    `UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  const updated = await getInvoiceById(invoiceId);
  if (!updated) {
    throw new Error('Invoice not found after update');
  }

  return updated;
}

/**
 * Delete invoice
 */
export async function deleteInvoice(invoiceId: string, userId: string): Promise<void> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Allow anyone to delete invoices
  await pool.query('DELETE FROM invoices WHERE id = ?', [invoiceId]);
}

/**
 * Get invoices with metadata (using view)
 */
export async function getInvoicesWithMetadata(
  teamView?: TeamView,
  search?: string
): Promise<InvoiceWithMetadata[]> {
  let whereClause = '1=1';
  const params: any[] = [];

  // Team view filtering
  if (teamView === 'RECON') {
    whereClause += " AND flow_type = 'MISSING_INVOICE'";
  } else if (teamView === 'AP') {
    whereClause += " AND ((flow_type = 'MISSING_INVOICE' AND current_stage = 'Sent to AP Processing') OR flow_type = 'PO_PENDING')";
  } else if (teamView === 'PAYMENT') {
    whereClause += " AND payment_status IN ('REQUESTED', 'PAID')";
  }

  // Search filtering
  if (search) {
    whereClause += ' AND (invoice_number LIKE ? OR vendor LIKE ? OR entity LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  const [rows] = await pool.query<(InvoiceWithMetadata & RowDataPacket)[]>(
    `SELECT * FROM invoices_with_metadata WHERE ${whereClause} ORDER BY created_at DESC`,
    params
  );

  return rows;
}

/**
 * Check if invoice number is unique
 */
export async function isInvoiceNumberUnique(
  invoiceNumber: string,
  excludeId?: string
): Promise<boolean> {
  let query = 'SELECT id FROM invoices WHERE invoice_number = ?';
  const params: any[] = [invoiceNumber];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  const [rows] = await pool.query<RowDataPacket[]>(query, params);

  return rows.length === 0;
}

/**
 * Get invoice statistics
 */
export async function getInvoiceStats() {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(*) as total_invoices,
      SUM(CASE WHEN flow_type = 'MISSING_INVOICE' THEN 1 ELSE 0 END) as missing_invoice_count,
      SUM(CASE WHEN flow_type = 'PO_PENDING' THEN 1 ELSE 0 END) as po_pending_count,
      SUM(CASE WHEN payment_status = 'REQUESTED' THEN 1 ELSE 0 END) as payment_requested_count,
      SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END) as payment_paid_count,
      SUM(amount) as total_amount
    FROM invoices
  `);

  return rows[0];
}
