import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  createUser,
  authenticateUser,
  getProfileById,
  updateProfile,
  createInvoice,
  getInvoicesWithMetadata,
  getInvoiceById,
  updateInvoice,
  updateInvoiceStage,
  deleteInvoice,
  createEvidence,
  getEvidenceByInvoiceId,
  deleteEvidence,
  createPaymentValidation,
  getPaymentValidationByInvoiceId,
  createAttachment,
  getAttachmentsByEvidenceId,
  getAttachmentsByPaymentValidationId,
  deleteAttachment
} from './db/repositories/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:3001', 'http://localhost:3002'], credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Auth middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'Staff' } = req.body;

    const { userId, profile } = await createUser(email, password, name, role);
    const token = jwt.sign({ id: userId, email, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.status(201).json({ user: profile, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authenticateUser(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: result.user.id, email: result.user.email, role: result.profile.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ user: result.profile, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const profile = await getProfileById(req.user.id);
    res.json({ user: profile });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Invoice routes
app.get('/api/invoices', authenticateToken, async (req: any, res) => {
  try {
    const { team_view, search } = req.query;
    const invoices = await getInvoicesWithMetadata(team_view, search);
    res.json(invoices);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/invoices', authenticateToken, async (req: any, res) => {
  try {
    const profile = await getProfileById(req.user.id);
    const { evidence, ...invoiceData } = req.body;

    const invoice = await createInvoice(invoiceData, req.user.id, profile?.name || req.user.email, profile?.role || 'Staff');

    // If evidence was provided, save it
    if (evidence && Array.isArray(evidence)) {
      for (const ev of evidence) {
        await createEvidence(
          invoice.id,
          ev.type || 'NOTE',
          ev.content,
          ev.stageAddedAt || invoice.current_stage,
          req.user.id,
          profile?.name || req.user.email
        );
      }
    }

    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoice = await updateInvoice(req.params.id, req.body);
    res.json(invoice);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', authenticateToken, async (req: any, res) => {
  try {
    await deleteInvoice(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/invoices/bulk-delete', authenticateToken, async (req: any, res) => {
  try {
    const { ids } = req.body;
    for (const id of ids) {
      await deleteInvoice(id, req.user.id);
    }
    res.json({ deleted: ids.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Evidence routes
app.get('/api/evidence/invoice/:invoiceId', authenticateToken, async (req, res) => {
  try {
    const evidence = await getEvidenceByInvoiceId(req.params.invoiceId);

    // Load attachments for each evidence
    const evidenceWithAttachments = await Promise.all(
      evidence.map(async (ev) => {
        const attachments = await getAttachmentsByEvidenceId(ev.id);
        return { ...ev, attachments };
      })
    );

    res.json(evidenceWithAttachments);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/evidence', authenticateToken, async (req: any, res) => {
  try {
    const { invoice_id, type, content, stage_added_at, attachments } = req.body;

    if (!invoice_id) {
      throw new Error('invoice_id is required');
    }

    const profile = await getProfileById(req.user.id);
    const evidence = await createEvidence(
      invoice_id,
      type,
      content || '',
      stage_added_at,
      req.user.id,
      profile?.name || req.user.email
    );

    // Create attachments if provided (files already uploaded to /uploads)
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        await createAttachment(
          att.name,
          att.url,
          att.type,
          att.size,
          evidence.id,
          undefined
        );
      }
    }

    // Reload evidence with attachments
    const evidenceWithAttachments = {
      ...evidence,
      attachments: attachments && Array.isArray(attachments) ?
        await getAttachmentsByEvidenceId(evidence.id) : []
    };

    res.status(201).json(evidenceWithAttachments);
  } catch (error: any) {
    console.error('Error creating evidence:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/evidence/:id', authenticateToken, async (req: any, res) => {
  try {
    await deleteEvidence(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Payment validation routes
app.get('/api/payment-validations/invoice/:invoiceId', authenticateToken, async (req, res) => {
  try {
    const validation = await getPaymentValidationByInvoiceId(req.params.invoiceId);

    // Load attachments if validation exists
    if (validation) {
      const attachments = await getAttachmentsByPaymentValidationId(validation.id);
      res.json({ ...validation, attachments });
    } else {
      res.json(null);
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/payment-validations', authenticateToken, async (req: any, res) => {
  try {
    const { invoice_id, comments, attachments } = req.body;
    const profile = await getProfileById(req.user.id);
    const validation = await createPaymentValidation(
      invoice_id,
      req.user.id,
      profile?.name || req.user.email,
      comments
    );

    // Create attachments if provided
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        await createAttachment(
          att.name,
          att.url,
          att.type,
          att.size,
          undefined,
          validation.id
        );
      }
    }

    res.status(201).json(validation);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Profile routes
app.get('/api/profiles/me', authenticateToken, async (req: any, res) => {
  try {
    const profile = await getProfileById(req.user.id);
    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/profiles/me', authenticateToken, async (req: any, res) => {
  try {
    const profile = await updateProfile(req.user.id, req.body);
    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.array('files', 10), async (req: any, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/${file.filename}`
    }));

    res.json({ files: uploadedFiles });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    res.status(400).json({ error: error.message });
  }
});

// Attachment routes
app.get('/api/attachments/evidence/:evidenceId', authenticateToken, async (req, res) => {
  try {
    const attachments = await getAttachmentsByEvidenceId(req.params.evidenceId);
    res.json(attachments);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/attachments/payment-validation/:paymentValidationId', authenticateToken, async (req, res) => {
  try {
    const attachments = await getAttachmentsByPaymentValidationId(req.params.paymentValidationId);
    res.json(attachments);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/attachments', authenticateToken, async (req: any, res) => {
  try {
    const { name, url, type, size, evidence_id, payment_validation_id } = req.body;
    const attachment = await createAttachment(name, url, type, size, evidence_id, payment_validation_id);
    res.status(201).json(attachment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/attachments/:id', authenticateToken, async (req, res) => {
  try {
    await deleteAttachment(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
