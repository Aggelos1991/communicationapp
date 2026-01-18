import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get payment validation for an invoice
router.get('/invoice/:invoiceId', async (req, res, next) => {
  try {
    const [validations] = await db.query(`
      SELECT pv.*
      FROM payment_validations pv
      WHERE pv.invoice_id = ?
    `, [req.params.invoiceId]);

    if (validations.length === 0) {
      return res.json(null);
    }

    // Fetch attachments for this payment validation
    const [attachments] = await db.query(
      'SELECT id, name, url, type, size, created_at FROM attachments WHERE payment_validation_id = ? ORDER BY created_at ASC',
      [validations[0].id]
    );

    res.json({
      ...validations[0],
      attachments
    });
  } catch (error) {
    next(error);
  }
});

// Create payment validation
router.post('/', async (req, res, next) => {
  try {
    const { invoice_id, comments, attachments } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    // Check if invoice exists
    const [invoice] = await db.query('SELECT id FROM invoices WHERE id = ?', [invoice_id]);
    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if validation already exists
    const [existing] = await db.query(
      'SELECT id FROM payment_validations WHERE invoice_id = ?',
      [invoice_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Payment validation already exists for this invoice' });
    }

    const validationId = uuidv4();

    // Get user name
    const [profile] = await db.query('SELECT name FROM profiles WHERE id = ?', [req.user.id]);
    const validated_by = profile[0]?.name || req.user.email;

    await db.query(`
      INSERT INTO payment_validations (id, invoice_id, validated_by, validated_by_id, comments)
      VALUES (?, ?, ?, ?, ?)
    `, [validationId, invoice_id, validated_by, req.user.id, comments || null]);

    // Link attachments to this payment validation if any were uploaded
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const file of attachments) {
        // Determine attachment type from mimetype or extension
        let attachmentType = 'OTHER';
        const mimetype = file.mimetype || '';
        if (mimetype.startsWith('image/')) {
          attachmentType = 'IMAGE';
        } else if (mimetype === 'application/pdf') {
          attachmentType = 'PDF';
        } else if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) {
          attachmentType = 'EXCEL';
        }

        const attachmentId = uuidv4();
        await db.query(`
          INSERT INTO attachments (id, payment_validation_id, name, url, type, size)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          attachmentId,
          validationId,
          file.originalName || file.filename,
          file.path,
          attachmentType,
          file.size || 0
        ]);
      }
    }

    // Update invoice payment status to PAID
    await db.query(
      "UPDATE invoices SET payment_status = 'PAID' WHERE id = ?",
      [invoice_id]
    );

    const [created] = await db.query(
      'SELECT * FROM payment_validations WHERE id = ?',
      [validationId]
    );

    res.status(201).json(created[0]);
  } catch (error) {
    next(error);
  }
});

// Update payment validation (only validator can update)
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    // Check ownership
    const [validation] = await db.query(
      'SELECT validated_by_id FROM payment_validations WHERE id = ?',
      [id]
    );

    if (validation.length === 0) {
      return res.status(404).json({ error: 'Payment validation not found' });
    }

    if (validation[0].validated_by_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the validator can update this record' });
    }

    await db.query(
      'UPDATE payment_validations SET comments = ? WHERE id = ?',
      [comments, id]
    );

    const [updated] = await db.query(
      'SELECT * FROM payment_validations WHERE id = ?',
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
