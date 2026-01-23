import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get invoices with metadata (replaces Supabase view)
router.get('/', async (req, res, next) => {
  try {
    const { team_view, search } = req.query;

    let whereClause = '1=1';
    const params = [];

    // Team view filtering
    if (team_view === 'RECON') {
      whereClause += " AND flow_type = 'MISSING_INVOICE'";
    } else if (team_view === 'AP') {
      whereClause += " AND ((flow_type = 'MISSING_INVOICE' AND current_stage = 'Sent to AP Processing') OR flow_type = 'PO_PENDING')";
    } else if (team_view === 'PAYMENT') {
      whereClause += " AND payment_status IN ('REQUESTED', 'PAID')";
    }

    // Search filtering
    if (search) {
      whereClause += ' AND (invoice_number LIKE ? OR vendor LIKE ? OR entity LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const [invoices] = await db.query(`
      SELECT * FROM invoices_with_metadata
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `, params);

    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

// Get invoice by ID
router.get('/:id', async (req, res, next) => {
  try {
    const [invoices] = await db.query(
      'SELECT * FROM invoices WHERE id = ?',
      [req.params.id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoices[0]);
  } catch (error) {
    next(error);
  }
});

// Create invoice
router.post('/', async (req, res, next) => {
  try {
    // Accept both snake_case and camelCase
    const invoice_number = req.body.invoice_number || req.body.invoiceNumber;
    const vendor = req.body.vendor;
    const amount = req.body.amount;
    const currency = req.body.currency || 'EUR';
    const entity = req.body.entity;
    const po_creator = req.body.po_creator || req.body.poCreator;
    const sharepoint_url = req.body.sharepoint_url || req.body.sharepointUrl;
    const flow_type = req.body.flow_type || req.body.flowType;
    const current_stage = req.body.current_stage || req.body.currentStage;
    const source = req.body.source || 'MANUAL';
    const status_detail = req.body.status_detail || req.body.statusDetail || 'NONE';
    const submission_timestamp = req.body.submission_timestamp || req.body.submissionTimestamp;

    // Validate required fields
    if (!invoice_number || !vendor || !flow_type || !current_stage) {
      return res.status(400).json({
        error: 'Missing required fields: invoice_number, vendor, flow_type, current_stage'
      });
    }

    // Check for duplicate invoice number
    const [existing] = await db.query(
      'SELECT id FROM invoices WHERE invoice_number = ?',
      [invoice_number]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Invoice number already exists' });
    }

    const invoiceId = uuidv4();

    // Get user details for audit trail
    const [profile] = await db.query(
      'SELECT name, role FROM profiles WHERE id = ?',
      [req.user.id]
    );

    const created_by = profile[0]?.name || req.user.email;
    const created_by_role = profile[0]?.role || 'Staff';

    await db.query(`
      INSERT INTO invoices (
        id, invoice_number, vendor, amount, currency, entity, po_creator,
        sharepoint_url, flow_type, current_stage, source, status_detail,
        submission_timestamp, created_by, created_by_role, created_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId, invoice_number, vendor, amount, currency, entity, po_creator,
      sharepoint_url, flow_type, current_stage, source, status_detail,
      submission_timestamp, created_by, created_by_role, req.user.id
    ]);

    // Fetch created invoice with metadata
    const [created] = await db.query(
      'SELECT * FROM invoices_with_metadata WHERE id = ?',
      [invoiceId]
    );

    res.status(201).json(created[0]);
  } catch (error) {
    next(error);
  }
});

// Update invoice
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('PATCH invoice body:', JSON.stringify(req.body, null, 2));
    console.log('PATCH invoice body keys:', Object.keys(req.body));

    // Map camelCase to snake_case
    const fieldMappings = {
      vendor: 'vendor',
      amount: 'amount',
      currency: 'currency',
      entity: 'entity',
      poCreator: 'po_creator',
      po_creator: 'po_creator',
      sharepointUrl: 'sharepoint_url',
      sharepoint_url: 'sharepoint_url',
      currentStage: 'current_stage',
      current_stage: 'current_stage',
      statusDetail: 'status_detail',
      status_detail: 'status_detail',
      paymentStatus: 'payment_status',
      payment_status: 'payment_status',
      paymentBlocked: 'payment_blocked',
      payment_blocked: 'payment_blocked',
      submissionTimestamp: 'submission_timestamp',
      submission_timestamp: 'submission_timestamp',
      blockReason: 'block_reason',
      block_reason: 'block_reason',
      blockAttachment: 'block_attachment',
      block_attachment: 'block_attachment'
    };

    const updates = {};
    Object.keys(req.body).forEach(key => {
      const dbField = fieldMappings[key];
      if (dbField && req.body[key] !== undefined) {
        let value = req.body[key];
        // Convert block_attachment object to JSON string for storage
        if (dbField === 'block_attachment' && typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        updates[dbField] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Check if invoice exists
    const [existing] = await db.query('SELECT id FROM invoices WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Build update query
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await db.query(`UPDATE invoices SET ${setClause} WHERE id = ?`, values);

    // Fetch updated invoice
    const [updated] = await db.query(
      'SELECT * FROM invoices_with_metadata WHERE id = ?',
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
});

// Delete invoice (only creator can delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const [invoice] = await db.query(
      'SELECT created_by_id FROM invoices WHERE id = ?',
      [id]
    );

    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice[0].created_by_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can delete this invoice' });
    }

    await db.query('DELETE FROM invoices WHERE id = ?', [id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Bulk update invoices (for payment blocked and stage changes)
router.post('/bulk-update', async (req, res, next) => {
  try {
    const { ids, updates } = req.body;
    console.log('Bulk update request:', { ids, updates });

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid invoice IDs' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid updates' });
    }

    // Map camelCase to snake_case
    const fieldMappings = {
      currentStage: 'current_stage',
      current_stage: 'current_stage',
      paymentBlocked: 'payment_blocked',
      payment_blocked: 'payment_blocked',
      paymentStatus: 'payment_status',
      payment_status: 'payment_status'
    };

    const dbUpdates = {};
    Object.keys(updates).forEach(key => {
      const dbField = fieldMappings[key];
      if (dbField && updates[key] !== undefined) {
        dbUpdates[dbField] = updates[key];
      }
    });

    console.log('DB updates:', dbUpdates);

    if (Object.keys(dbUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Build update query
    const setClause = Object.keys(dbUpdates).map(key => `${key} = ?`).join(', ');
    const placeholders = ids.map(() => '?').join(',');
    const values = [...Object.values(dbUpdates), ...ids];

    console.log('SQL:', `UPDATE invoices SET ${setClause} WHERE id IN (${placeholders})`);
    console.log('Values:', values);

    const [result] = await db.query(
      `UPDATE invoices SET ${setClause} WHERE id IN (${placeholders})`,
      values
    );

    console.log('Update result:', result);
    console.log('Affected rows:', result.affectedRows);

    res.json({ updated: ids.length, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Bulk update error:', error);
    next(error);
  }
});

// Bulk delete invoices
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid invoice IDs' });
    }

    // Check ownership for all invoices
    const placeholders = ids.map(() => '?').join(',');
    const [invoices] = await db.query(
      `SELECT id FROM invoices WHERE id IN (${placeholders}) AND created_by_id = ?`,
      [...ids, req.user.id]
    );

    if (invoices.length !== ids.length) {
      return res.status(403).json({
        error: 'You can only delete invoices you created'
      });
    }

    await db.query(
      `DELETE FROM invoices WHERE id IN (${placeholders})`,
      ids
    );

    res.json({ deleted: ids.length });
  } catch (error) {
    next(error);
  }
});

// Get statistics
router.get('/stats/summary', async (req, res, next) => {
  try {
    const [stats] = await db.query(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(CASE WHEN flow_type = 'MISSING_INVOICE' THEN 1 ELSE 0 END) as missing_invoice_count,
        SUM(CASE WHEN flow_type = 'PO_PENDING' THEN 1 ELSE 0 END) as po_pending_count,
        SUM(CASE WHEN payment_status = 'REQUESTED' THEN 1 ELSE 0 END) as payment_requested_count,
        SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END) as payment_paid_count,
        SUM(amount) as total_amount
      FROM invoices
    `);

    res.json(stats[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
