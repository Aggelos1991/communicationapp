import pool from '../connection';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import type { Attachment, CompressedAttachment } from '../types';

// Frontend attachment format
interface FrontendAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * Create compressed attachment (must belong to EITHER evidence OR payment_validation)
 */
export async function createAttachment(
  attachment: FrontendAttachment,
  evidenceId?: string,
  paymentValidationId?: string
): Promise<FrontendAttachment> {
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

  const attachmentId = attachment.id || uuidv4();

  await pool.query(
    `INSERT INTO attachments (id, evidence_id, payment_validation_id, name, data, mime_type, original_size, compressed_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachmentId,
      evidenceId || null,
      paymentValidationId || null,
      attachment.name,
      attachment.data,
      attachment.mimeType,
      attachment.originalSize || 0,
      attachment.compressedSize || 0
    ]
  );

  const created = await getAttachmentById(attachmentId);
  if (!created) {
    throw new Error('Failed to create attachment');
  }

  return created;
}

/**
 * Get attachment by ID (returns frontend format)
 */
export async function getAttachmentById(attachmentId: string): Promise<FrontendAttachment | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, data, mime_type, original_size, compressed_size FROM attachments WHERE id = ?',
    [attachmentId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    data: row.data,
    originalSize: row.original_size,
    compressedSize: row.compressed_size
  };
}

/**
 * Get attachments for evidence (returns frontend format)
 */
export async function getAttachmentsByEvidenceId(evidenceId: string): Promise<FrontendAttachment[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, data, mime_type, original_size, compressed_size FROM attachments WHERE evidence_id = ? ORDER BY created_at ASC',
    [evidenceId]
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    data: row.data,
    originalSize: row.original_size,
    compressedSize: row.compressed_size
  }));
}

/**
 * Get attachments for payment validation (returns frontend format)
 */
export async function getAttachmentsByPaymentValidationId(
  paymentValidationId: string
): Promise<FrontendAttachment[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, data, mime_type, original_size, compressed_size FROM attachments WHERE payment_validation_id = ? ORDER BY created_at ASC',
    [paymentValidationId]
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    data: row.data,
    originalSize: row.original_size,
    compressedSize: row.compressed_size
  }));
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
