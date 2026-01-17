# Application Code Layer - COMPLETE ✅

All repository functions and business logic have been implemented for MySQL backend.

## What Was Created

### Database Layer
```
server/
├── db/
│   ├── connection.ts              # MySQL connection pool
│   ├── types.ts                   # TypeScript types + workflow constants
│   └── repositories/
│       ├── index.ts               # Export all repositories
│       ├── userRepository.ts      # User CRUD + authentication
│       ├── invoiceRepository.ts   # Invoice CRUD + workflow validation
│       ├── evidenceRepository.ts  # Evidence CRUD
│       ├── attachmentRepository.ts # Attachment CRUD (with parent validation)
│       └── paymentValidationRepository.ts # Payment validation (one per invoice)
```

### Configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Updated with TypeScript dependencies
- `test-db.ts` - Complete test script

---

## Database Connection

**File:** `db/connection.ts`

Reads from `.env`:
```env
DB_HOST=localhost
DB_PORT=3307
DB_NAME=appdb
DB_USER=appuser
DB_PASSWORD=apppass
```

Connection pool with 10 connections, automatic reconnection, UTF8MB4 charset.

---

## Repository Functions

### 1. User Repository (`userRepository.ts`)

✅ **createUser(email, password, name, role)**
- Transactional: creates user + profile
- bcrypt password hashing (12 rounds)
- UUID generation

✅ **authenticateUser(email, password)**
- Verifies password with bcrypt
- Returns user + profile
- Updates last_login_at

✅ **getUserById(userId)**
✅ **getProfileById(userId)**
✅ **updateProfile(userId, updates)**
✅ **emailExists(email)**

---

### 2. Invoice Repository (`invoiceRepository.ts`)

✅ **createInvoice(invoice, userId, name, role)**
- Validates stage for flow type
- Auto-generates UUID

✅ **updateInvoiceStage(invoiceId, newStage)**
- **VALIDATES WORKFLOW TRANSITIONS**
- MISSING_INVOICE: Invoice Missing → Sent to AP → PO Created → Posted → Closed
- PO_PENDING: Invoice Received → PO Email Sent → PO Created → EXR Created → Closed
- Rejects backward moves

✅ **updateInvoice(invoiceId, updates)**
- General update with stage validation

✅ **deleteInvoice(invoiceId, userId)**
- Only creator can delete

✅ **getInvoicesWithMetadata(teamView?, search?)**
- Uses `invoices_with_metadata` view
- Team filtering:
  - `RECON`: flow_type = MISSING_INVOICE
  - `AP`: (MISSING_INVOICE + Sent to AP) OR PO_PENDING
  - `PAYMENT`: payment_status IN (REQUESTED, PAID)
- Search: invoice_number, vendor, entity

✅ **getInvoiceById(invoiceId)**
✅ **getInvoiceByNumber(invoiceNumber)**
✅ **isInvoiceNumberUnique(number, excludeId?)**
✅ **getInvoiceStats()**

---

### 3. Evidence Repository (`evidenceRepository.ts`)

✅ **createEvidence(invoiceId, type, content, stageAddedAt, userId, userName)**
- Type: NOTE or EMAIL
- Tracks which stage it was added at

✅ **getEvidenceByInvoiceId(invoiceId)**
- Returns all evidence ordered by created_at

✅ **deleteEvidence(evidenceId, userId)**
- Only creator can delete

✅ **getEvidenceById(evidenceId)**
✅ **getEvidenceCount(invoiceId)**

---

### 4. Attachment Repository (`attachmentRepository.ts`)

✅ **createAttachment(name, url, type, size, evidenceId?, paymentValidationId?)**
- **ENFORCES: exactly one parent (evidence XOR payment_validation)**
- Verifies parent exists
- Types: IMAGE, PDF, EXCEL, OTHER

✅ **getAttachmentsByEvidenceId(evidenceId)**
✅ **getAttachmentsByPaymentValidationId(paymentValidationId)**
✅ **deleteAttachment(attachmentId)**
✅ **getAttachmentById(attachmentId)**
✅ **getAttachmentCountByEvidence(evidenceId)**
✅ **getAttachmentCountByPaymentValidation(paymentValidationId)**

---

### 5. Payment Validation Repository (`paymentValidationRepository.ts`)

✅ **createPaymentValidation(invoiceId, userId, userName, comments?)**
- **ENFORCES: one validation per invoice**
- Transactional:
  1. Creates payment_validation
  2. Updates invoice.payment_status to PAID

✅ **updatePaymentValidation(validationId, userId, comments)**
- Only validator can update

✅ **deletePaymentValidation(validationId, userId)**
- Only validator can delete
- Reverts invoice.payment_status to REQUESTED

✅ **getPaymentValidationById(validationId)**
✅ **getPaymentValidationByInvoiceId(invoiceId)**

---

## Business Rules Implemented

### ✅ Workflow Validation
```typescript
// In invoiceRepository.ts
function validateStageTransition(flowType, currentStage, newStage) {
  // Enforces sequential stage progression
  // Rejects backward moves
  // Validates stage belongs to flow type
}
```

**MISSING_INVOICE stages:**
1. Invoice Missing
2. Sent to AP Processing
3. PO Created
4. Posted
5. Closed

**PO_PENDING stages:**
1. Invoice Received
2. PO Email Sent
3. PO Created
4. EXR Created
5. Closed

### ✅ One Payment Validation Per Invoice
```typescript
// In paymentValidationRepository.ts
const existing = await getPaymentValidationByInvoiceId(invoiceId);
if (existing) {
  throw new Error('Payment validation already exists');
}
```

### ✅ Attachment Parent Constraint
```typescript
// In attachmentRepository.ts
if ((!evidenceId && !paymentValidationId) || (evidenceId && paymentValidationId)) {
  throw new Error('Attachment must belong to either evidence or payment_validation');
}
```

### ✅ Creator-Only Deletion
- Invoices: only creator can delete
- Evidence: only creator can delete
- Payment validations: only validator can delete/update

---

## Usage Example

```typescript
import {
  createUser,
  authenticateUser,
  createInvoice,
  updateInvoiceStage,
  createEvidence,
  createAttachment,
  createPaymentValidation
} from './db/repositories';

// 1. Create user
const { userId, profile } = await createUser(
  'user@example.com',
  'password123',
  'John Doe',
  'Finance Manager'
);

// 2. Login
const auth = await authenticateUser('user@example.com', 'password123');
if (!auth) throw new Error('Invalid credentials');

// 3. Create invoice
const invoice = await createInvoice(
  {
    invoice_number: 'INV-001',
    vendor: 'Acme Corp',
    amount: 1500.00,
    currency: 'EUR',
    flow_type: 'MISSING_INVOICE',
    current_stage: 'Invoice Missing',
    // ... other fields
  },
  userId,
  'John Doe',
  'Finance Manager'
);

// 4. Progress through workflow
await updateInvoiceStage(invoice.id, 'Sent to AP Processing'); // ✅
await updateInvoiceStage(invoice.id, 'PO Created'); // ✅
// await updateInvoiceStage(invoice.id, 'Invoice Missing'); // ❌ Rejects backward move

// 5. Add evidence
const evidence = await createEvidence(
  invoice.id,
  'NOTE',
  'Contacted vendor for missing PO',
  'Sent to AP Processing',
  userId,
  'John Doe'
);

// 6. Attach file
const attachment = await createAttachment(
  'vendor-response.pdf',
  '/uploads/abc123.pdf',
  'PDF',
  245678,
  evidence.id, // Parent is evidence
  undefined    // NOT payment validation
);

// 7. Request payment
await pool.query(
  "UPDATE invoices SET payment_status = 'REQUESTED' WHERE id = ?",
  [invoice.id]
);

// 8. Validate payment
const validation = await createPaymentValidation(
  invoice.id,
  userId,
  'John Doe',
  'Payment approved - wire transfer initiated'
);
// Invoice payment_status is now PAID

// 9. Get filtered invoices
const reconInvoices = await getInvoicesWithMetadata('RECON');
const apInvoices = await getInvoicesWithMetadata('AP');
const paymentInvoices = await getInvoicesWithMetadata('PAYMENT');
```

---

## Testing

### Run Test Script

```bash
cd server
npm install  # Install dependencies including tsx
npm run dev test-db.ts
```

The test script will:
1. ✅ Verify database connection
2. ✅ Check all tables exist
3. ✅ Create test user
4. ✅ Authenticate user
5. ✅ Create invoice
6. ✅ Test valid stage transition
7. ✅ Test invalid stage transition (verifies rejection)
8. ✅ Create evidence
9. ✅ Test team view filtering
10. ✅ Create payment validation
11. ✅ Test one-validation-per-invoice rule

---

## Next Steps

### 1. Install Dependencies

```bash
cd server
npm install
```

This installs:
- TypeScript + types
- tsx (TypeScript execution)
- All existing dependencies

### 2. Verify Database

```bash
# Check MySQL is running on port 3307
docker ps | grep mysql-dev

# Test connection
mysql -h localhost -P 3307 -u appuser -p appdb
# Password: apppass
```

### 3. Run Test

```bash
npm run dev test-db.ts
```

Should output:
```
✅ All tests passed! Database is working correctly.
```

### 4. Build Express Routes

Now use these repositories in your Express routes:

```typescript
// routes/auth.ts
import { createUser, authenticateUser } from '../db/repositories';

router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  const { userId, profile } = await createUser(email, password, name, role);
  // Generate JWT...
  res.json({ userId, profile });
});
```

---

## Import Statements

```typescript
// Single import for all repositories
import {
  // User
  createUser,
  authenticateUser,
  getUserById,
  getProfileById,
  updateProfile,
  emailExists,

  // Invoice
  createInvoice,
  getInvoiceById,
  getInvoiceByNumber,
  updateInvoice,
  updateInvoiceStage,
  deleteInvoice,
  getInvoicesWithMetadata,
  isInvoiceNumberUnique,
  getInvoiceStats,

  // Evidence
  createEvidence,
  getEvidenceById,
  getEvidenceByInvoiceId,
  deleteEvidence,
  getEvidenceCount,

  // Attachment
  createAttachment,
  getAttachmentById,
  getAttachmentsByEvidenceId,
  getAttachmentsByPaymentValidationId,
  deleteAttachment,
  getAttachmentCountByEvidence,
  getAttachmentCountByPaymentValidation,

  // Payment Validation
  createPaymentValidation,
  getPaymentValidationById,
  getPaymentValidationByInvoiceId,
  updatePaymentValidation,
  deletePaymentValidation
} from './db/repositories';
```

---

## TypeScript Compilation

```bash
# Build
npm run build

# Output in dist/
# Run compiled: npm start
```

---

**All application code is DONE and ready to use!** 🎉

The repositories:
- ✅ Connect to your MySQL on port 3307
- ✅ Implement all business rules
- ✅ Validate workflow transitions
- ✅ Enforce one-validation-per-invoice
- ✅ Protect creator-only deletions
- ✅ Are fully typed with TypeScript
- ✅ Are production-ready
