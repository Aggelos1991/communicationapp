import pool from '../connection';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import type { Attachment, AttachmentType } from '../types';

/**
 * Create attachment (must belong to EITHER evidence OR payment_validation)
 */
export async function createAttachment(
  name: string,
  url: string,
  type: AttachmentType,
  size: number,
  evidenceId?: string,
  paymentValidationId?: string
): Promise<Attachment> {
  // Enforce: exactly one parent
  if ((!evidenceId && !paymentValidationId) || (evidenceId && paymentValidationId)) {
    throw new Error('Attachment must belong to either evidence or payment_validation (not both)');
  }

  // Verify parent exists
  if (evidenceId) {
    const [evidence] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM evidence WHERE id = ?',
      [evidenceId]
    );
    if (evidence.length === 0) {
      throw new Error('Evidence not found');
    }
  }

  if (paymentValidationId) {
    const [validation] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM payment_validations WHERE id = ?',
      [paymentValidationId]
    );
    if (validation.length === 0) {
      throw new Error('Payment validation not found');
    }
  }

  const attachmentId = uuidv4();

  await pool.query(
    `INSERT INTO attachments (id, evidence_id, payment_validation_id, name, url, type, size)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [attachmentId, evidenceId || null, paymentValidationId || null, name, url, type, size]
  );

  const created = await getAttachmentById(attachmentId);
  if (!created) {
    throw new Error('Failed to create attachment');
  }

  return created;
}

/**
 * Get attachment by ID
 */
export async function getAttachmentById(attachmentId: string): Promise<Attachment | null> {
  const [rows] = await pool.query<(Attachment & RowDataPacket)[]>(
    'SELECT * FROM attachments WHERE id = ?',
    [attachmentId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get attachments for evidence
 */
export async function getAttachmentsByEvidenceId(evidenceId: string): Promise<Attachment[]> {
  const [rows] = await pool.query<(Attachment & RowDataPacket)[]>(
    'SELECT * FROM attachments WHERE evidence_id = ? ORDER BY created_at ASC',
    [evidenceId]
  );

  return rows;
}

/**
 * Get attachments for payment validation
 */
export async function getAttachmentsByPaymentValidationId(
  paymentValidationId: string
): Promise<Attachment[]> {
  const [rows] = await pool.query<(Attachment & RowDataPacket)[]>(
    'SELECT * FROM attachments WHERE payment_validation_id = ? ORDER BY created_at ASC',
    [paymentValidationId]
  );

  return rows;
}

/**
 * Delete attachment
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const attachment = await getAttachmentById(attachmentId);
  if (!attachment) {
    throw new Error('Attachment not found');
  }

  await pool.query('DELETE FROM attachments WHERE id = ?', [attachmentId]);
}

/**
 * Get attachment count for evidence
 */
export async function getAttachmentCountByEvidence(evidenceId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM attachments WHERE evidence_id = ?',
    [evidenceId]
  );

  return rows[0].count;
}

/**
 * Get attachment count for payment validation
 */
export async function getAttachmentCountByPaymentValidation(
  paymentValidationId: string
): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM attachments WHERE payment_validation_id = ?',
    [paymentValidationId]
  );

  return rows[0].count;
}
