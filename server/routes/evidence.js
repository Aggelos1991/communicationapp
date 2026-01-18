import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get evidence for an invoice
router.get('/invoice/:invoiceId', async (req, res, next) => {
  try {
    const [evidence] = await db.query(`
      SELECT e.*
      FROM evidence e
      WHERE e.invoice_id = ?
      ORDER BY e.created_at ASC
    `, [req.params.invoiceId]);

    // Fetch attachments for each evidence item
    const evidenceWithAttachments = await Promise.all(
      evidence.map(async (ev) => {
        const [attachments] = await db.query(
          'SELECT id, name, url, type, size, created_at FROM attachments WHERE evidence_id = ? ORDER BY created_at ASC',
          [ev.id]
        );
        return {
          ...ev,
          attachments
        };
      })
    );

    res.json(evidenceWithAttachments);
  } catch (error) {
    next(error);
  }
});

// Create evidence
router.post('/', async (req, res, next) => {
  try {
    const { invoice_id, type, content, stage_added_at, attachments } = req.body;

    if (!invoice_id || !type || !content || !stage_added_at) {
      return res.status(400).json({
        error: 'Missing required fields: invoice_id, type, content, stage_added_at'
      });
    }

    // Verify invoice exists
    const [invoice] = await db.query('SELECT id FROM invoices WHERE id = ?', [invoice_id]);
    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const evidenceId = uuidv4();

    // Get user name
    const [profile] = await db.query('SELECT name FROM profiles WHERE id = ?', [req.user.id]);
    const created_by = profile[0]?.name || req.user.email;

    await db.query(`
      INSERT INTO evidence (id, invoice_id, type, content, stage_added_at, created_by, created_by_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [evidenceId, invoice_id, type, content, stage_added_at, created_by, req.user.id]);

    // Link attachments to this evidence if any were uploaded
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
          INSERT INTO attachments (id, evidence_id, name, url, type, size)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          attachmentId,
          evidenceId,
          file.originalName || file.filename,
          file.path,
          attachmentType,
          file.size || 0
        ]);
      }
    }

    const [created] = await db.query('SELECT * FROM evidence WHERE id = ?', [evidenceId]);

    res.status(201).json(created[0]);
  } catch (error) {
    next(error);
  }
});

// Delete evidence (only creator)
router.delete('/:id', async (req, res, next) => {
  try {
    const [evidence] = await db.query(
      'SELECT created_by_id FROM evidence WHERE id = ?',
      [req.params.id]
    );

    if (evidence.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidence[0].created_by_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can delete this evidence' });
    }

    await db.query('DELETE FROM evidence WHERE id = ?', [req.params.id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
