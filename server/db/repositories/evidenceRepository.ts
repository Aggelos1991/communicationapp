import pool from '../connection';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import type { Evidence, EvidenceType } from '../types';

/**
 * Create evidence (NOTE or EMAIL)
 */
export async function createEvidence(
  invoiceId: string,
  type: EvidenceType,
  content: string,
  stageAddedAt: string,
  createdByUserId: string,
  createdByName: string
): Promise<Evidence> {
  const evidenceId = uuidv4();

  await pool.query(
    `INSERT INTO evidence (id, invoice_id, type, content, stage_added_at, created_by, created_by_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [evidenceId, invoiceId, type, content, stageAddedAt, createdByName, createdByUserId]
  );

  const created = await getEvidenceById(evidenceId);
  if (!created) {
    throw new Error('Failed to create evidence');
  }

  return created;
}

/**
 * Get evidence by ID
 */
export async function getEvidenceById(evidenceId: string): Promise<Evidence | null> {
  const [rows] = await pool.query<(Evidence & RowDataPacket)[]>(
    'SELECT * FROM evidence WHERE id = ?',
    [evidenceId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all evidence for an invoice
 */
export async function getEvidenceByInvoiceId(invoiceId: string): Promise<Evidence[]> {
  const [rows] = await pool.query<(Evidence & RowDataPacket)[]>(
    'SELECT * FROM evidence WHERE invoice_id = ? ORDER BY created_at ASC',
    [invoiceId]
  );

  return rows;
}

/**
 * Delete evidence (only by creator)
 */
export async function deleteEvidence(evidenceId: string, userId: string): Promise<void> {
  const evidence = await getEvidenceById(evidenceId);
  if (!evidence) {
    throw new Error('Evidence not found');
  }

  // Allow anyone to delete evidence
  await pool.query('DELETE FROM evidence WHERE id = ?', [evidenceId]);
}

/**
 * Get evidence count for invoice
 */
export async function getEvidenceCount(invoiceId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM evidence WHERE invoice_id = ?',
    [invoiceId]
  );

  return rows[0].count;
}
