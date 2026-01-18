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

// Get attachments for evidence
router.get('/evidence/:evidenceId', async (req, res, next) => {
  try {
    const [attachments] = await db.query(
      'SELECT * FROM attachments WHERE evidence_id = ? ORDER BY created_at ASC',
      [req.params.evidenceId]
    );

    res.json(attachments);
  } catch (error) {
    next(error);
  }
});

// Get attachments for payment validation
router.get('/payment-validation/:paymentValidationId', async (req, res, next) => {
  try {
    const [attachments] = await db.query(
      'SELECT * FROM attachments WHERE payment_validation_id = ? ORDER BY created_at ASC',
      [req.params.paymentValidationId]
    );

    res.json(attachments);
  } catch (error) {
    next(error);
  }
});

// Upload attachment
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    // Accept both snake_case and camelCase
    const evidence_id = req.body.evidence_id || req.body.evidenceId;
    const payment_validation_id = req.body.payment_validation_id || req.body.paymentValidationId;

    // Must have exactly one parent
    if ((!evidence_id && !payment_validation_id) || (evidence_id && payment_validation_id)) {
      return res.status(400).json({
        error: 'Must specify either evidence_id or payment_validation_id (not both)'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify parent exists
    if (evidence_id) {
      const [evidence] = await db.query('SELECT id FROM evidence WHERE id = ?', [evidence_id]);
      if (evidence.length === 0) {
        await fs.unlink(req.file.path); // Clean up uploaded file
        return res.status(404).json({ error: 'Evidence not found' });
      }
    }

    if (payment_validation_id) {
      const [pv] = await db.query('SELECT id FROM payment_validations WHERE id = ?', [payment_validation_id]);
      if (pv.length === 0) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ error: 'Payment validation not found' });
      }
    }

    // Determine attachment type
    let attachmentType = 'OTHER';
    if (req.file.mimetype.startsWith('image/')) {
      attachmentType = 'IMAGE';
    } else if (req.file.mimetype === 'application/pdf') {
      attachmentType = 'PDF';
    } else if (req.file.mimetype.includes('excel') || req.file.mimetype.includes('spreadsheet')) {
      attachmentType = 'EXCEL';
    }

    const attachmentId = uuidv4();
    const url = `/uploads/attachments/${req.file.filename}`;

    await db.query(`
      INSERT INTO attachments (id, evidence_id, payment_validation_id, name, url, type, size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      attachmentId,
      evidence_id || null,
      payment_validation_id || null,
      req.file.originalname,
      url,
      attachmentType,
      req.file.size
    ]);

    const [created] = await db.query('SELECT * FROM attachments WHERE id = ?', [attachmentId]);

    res.status(201).json(created[0]);
  } catch (error) {
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
});

// Delete attachment
router.delete('/:id', async (req, res, next) => {
  try {
    const [attachment] = await db.query(
      'SELECT url FROM attachments WHERE id = ?',
      [req.params.id]
    );

    if (attachment.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), attachment[0].url);
    await fs.unlink(filePath).catch(() => {
      console.warn('Could not delete file:', filePath);
    });

    // Delete from database
    await db.query('DELETE FROM attachments WHERE id = ?', [req.params.id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
