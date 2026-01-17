import pool from '../connection';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import type { PaymentValidation } from '../types';

/**
 * Create payment validation (one per invoice)
 */
export async function createPaymentValidation(
  invoiceId: string,
  validatedByUserId: string,
  validatedByName: string,
  comments?: string
): Promise<PaymentValidation> {
  // Check if validation already exists
  const existing = await getPaymentValidationByInvoiceId(invoiceId);
  if (existing) {
    throw new Error('Payment validation already exists for this invoice');
  }

  // Verify invoice exists (removed - not needed, will fail on foreign key constraint if invalid)

  const validationId = uuidv4();

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Insert payment validation
    await connection.query(
      `INSERT INTO payment_validations (id, invoice_id, validated_by, validated_by_id, comments)
       VALUES (?, ?, ?, ?, ?)`,
      [validationId, invoiceId, validatedByName, validatedByUserId, comments || null]
    );

    // Update invoice payment_status to PAID
    await connection.query(
      "UPDATE invoices SET payment_status = 'PAID' WHERE id = ?",
      [invoiceId]
    );

    await connection.commit();

    const created = await getPaymentValidationById(validationId);
    if (!created) {
      throw new Error('Failed to create payment validation');
    }

    return created;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get payment validation by ID
 */
export async function getPaymentValidationById(
  validationId: string
): Promise<PaymentValidation | null> {
  const [rows] = await pool.query<(PaymentValidation & RowDataPacket)[]>(
    'SELECT * FROM payment_validations WHERE id = ?',
    [validationId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get payment validation by invoice ID
 */
export async function getPaymentValidationByInvoiceId(
  invoiceId: string
): Promise<PaymentValidation | null> {
  const [rows] = await pool.query<(PaymentValidation & RowDataPacket)[]>(
    'SELECT * FROM payment_validations WHERE invoice_id = ?',
    [invoiceId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update payment validation (only by validator)
 */
export async function updatePaymentValidation(
  validationId: string,
  userId: string,
  comments: string
): Promise<PaymentValidation> {
  const validation = await getPaymentValidationById(validationId);
  if (!validation) {
    throw new Error('Payment validation not found');
  }

  if (validation.validated_by_id !== userId) {
    throw new Error('Only the validator can update this payment validation');
  }

  await pool.query(
    'UPDATE payment_validations SET comments = ? WHERE id = ?',
    [comments, validationId]
  );

  const updated = await getPaymentValidationById(validationId);
  if (!updated) {
    throw new Error('Payment validation not found after update');
  }

  return updated;
}

/**
 * Delete payment validation (also reverts invoice payment_status)
 */
export async function deletePaymentValidation(
  validationId: string,
  userId: string
): Promise<void> {
  const validation = await getPaymentValidationById(validationId);
  if (!validation) {
    throw new Error('Payment validation not found');
  }

  if (validation.validated_by_id !== userId) {
    throw new Error('Only the validator can delete this payment validation');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Delete validation
    await connection.query('DELETE FROM payment_validations WHERE id = ?', [validationId]);

    // Revert invoice payment_status to REQUESTED
    await connection.query(
      "UPDATE invoices SET payment_status = 'REQUESTED' WHERE id = ?",
      [validation.invoice_id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
