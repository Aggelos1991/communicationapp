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

    // Fetch compressed attachments for each evidence item
    const evidenceWithAttachments = await Promise.all(
      evidence.map(async (ev) => {
        const [attachments] = await db.query(
          'SELECT id, name, data, mime_type, original_size, compressed_size, created_at FROM attachments WHERE evidence_id = ? ORDER BY created_at ASC',
          [ev.id]
        );
        // Map to frontend format
        const formattedAttachments = attachments.map(att => ({
          id: att.id,
          name: att.name,
          mimeType: att.mime_type,
          data: att.data,
          originalSize: att.original_size,
          compressedSize: att.compressed_size
        }));
        return {
          ...ev,
          attachments: formattedAttachments
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
    console.log('Evidence POST body:', JSON.stringify(req.body, null, 2));

    // Accept both snake_case and camelCase
    const invoice_id = req.body.invoice_id || req.body.invoiceId;
    const type = req.body.type;
    const content = req.body.content;
    const stage_added_at = req.body.stage_added_at || req.body.stageAddedAt;
    const attachments = req.body.attachments;

    // Allow empty content if there are attachments
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
    const hasContent = content && content.trim().length > 0;

    if (!invoice_id || !type || !stage_added_at) {
      console.log('Missing fields - invoice_id:', invoice_id, 'type:', type, 'stage_added_at:', stage_added_at);
      return res.status(400).json({
        error: 'Missing required fields: invoice_id, type, stage_added_at'
      });
    }

    if (!hasContent && !hasAttachments) {
      console.log('No content or attachments provided');
      return res.status(400).json({
        error: 'Evidence must have either content or attachments'
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

    // Use content or default to 'Attachment' if only attachment provided
    const finalContent = hasContent ? content : 'Attachment';

    await db.query(`
      INSERT INTO evidence (id, invoice_id, type, content, stage_added_at, created_by, created_by_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [evidenceId, invoice_id, type, finalContent, stage_added_at, created_by, req.user.id]);

    // Link compressed attachments to this evidence if any were uploaded
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const file of attachments) {
        const attachmentId = file.id || uuidv4();
        await db.query(`
          INSERT INTO attachments (id, evidence_id, name, data, mime_type, original_size, compressed_size)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          attachmentId,
          evidenceId,
          file.name,
          file.data,
          file.mimeType,
          file.originalSize || 0,
          file.compressedSize || 0
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
