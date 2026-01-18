import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import invoiceRoutes from './routes/invoices.js';
import evidenceRoutes from './routes/evidence.js';
import attachmentRoutes from './routes/attachments.js';
import paymentValidationRoutes from './routes/paymentValidations.js';
import profileRoutes from './routes/profiles.js';
import uploadRoutes from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files with proper CORS headers for downloads
app.use('/uploads', (req, res, next) => {
  // Set headers to force download
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  next();
}, express.static('uploads'));

// Download endpoint with proper Content-Disposition header for cross-origin downloads
app.get('/api/download/*', (req, res) => {
  const filePath = req.params[0];
  const fullPath = path.join(process.cwd(), 'uploads', filePath);

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(fullPath);
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!normalizedPath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Get the original filename from query param or use the file's basename
  const originalName = req.query.name || path.basename(filePath);

  // Set Content-Disposition header to force download
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  res.sendFile(fullPath);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/payment-validations', paymentValidationRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/upload', uploadRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Invoice Tracker API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});
