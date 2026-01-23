import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/attachments';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, PDF, Excel'));
    }
  }
});

// Get attachments for evidence (compressed format)
router.get('/evidence/:evidenceId', async (req, res, next) => {
  try {
    const [attachments] = await db.query(
      'SELECT id, name, data, mime_type, original_size, compressed_size, created_at FROM attachments WHERE evidence_id = ? ORDER BY created_at ASC',
      [req.params.evidenceId]
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

    res.json(formattedAttachments);
  } catch (error) {
    next(error);
  }
});

// Get attachments for payment validation (compressed format)
router.get('/payment-validation/:paymentValidationId', async (req, res, next) => {
  try {
    const [attachments] = await db.query(
      'SELECT id, name, data, mime_type, original_size, compressed_size, created_at FROM attachments WHERE payment_validation_id = ? ORDER BY created_at ASC',
      [req.params.paymentValidationId]
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

    res.json(formattedAttachments);
  } catch (error) {
    next(error);
  }
});

// Upload compressed attachment (JSON data from frontend)
router.post('/upload', async (req, res, next) => {
  try {
    // Accept both snake_case and camelCase
    const evidence_id = req.body.evidence_id || req.body.evidenceId;
    const payment_validation_id = req.body.payment_validation_id || req.body.paymentValidationId;
    const attachment = req.body.attachment;

    // Must have exactly one parent
    if ((!evidence_id && !payment_validation_id) || (evidence_id && payment_validation_id)) {
      return res.status(400).json({
        error: 'Must specify either evidence_id or payment_validation_id (not both)'
      });
    }

    if (!attachment || !attachment.data) {
      return res.status(400).json({ error: 'No attachment data provided' });
    }

    // Verify parent exists
    if (evidence_id) {
      const [evidence] = await db.query('SELECT id FROM evidence WHERE id = ?', [evidence_id]);
      if (evidence.length === 0) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
    }

    if (payment_validation_id) {
      const [pv] = await db.query('SELECT id FROM payment_validations WHERE id = ?', [payment_validation_id]);
      if (pv.length === 0) {
        return res.status(404).json({ error: 'Payment validation not found' });
      }
    }

    const attachmentId = attachment.id || uuidv4();

    await db.query(`
      INSERT INTO attachments (id, evidence_id, payment_validation_id, name, data, mime_type, original_size, compressed_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      attachmentId,
      evidence_id || null,
      payment_validation_id || null,
      attachment.name,
      attachment.data,
      attachment.mimeType,
      attachment.originalSize || 0,
      attachment.compressedSize || 0
    ]);

    const [created] = await db.query(
      'SELECT id, name, data, mime_type, original_size, compressed_size FROM attachments WHERE id = ?',
      [attachmentId]
    );

    res.status(201).json({
      id: created[0].id,
      name: created[0].name,
      mimeType: created[0].mime_type,
      data: created[0].data,
      originalSize: created[0].original_size,
      compressedSize: created[0].compressed_size
    });
  } catch (error) {
    next(error);
  }
});

// Delete attachment (compressed data stored in DB, no file to delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const [attachment] = await db.query(
      'SELECT id FROM attachments WHERE id = ?',
      [req.params.id]
    );

    if (attachment.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete from database
    await db.query('DELETE FROM attachments WHERE id = ?', [req.params.id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
