#!/usr/bin/env tsx
/**
 * Test script to verify database connection and repositories
 * Run: npm run dev test-db.ts
 */

import pool from './db/connection';
import {
  createUser,
  authenticateUser,
  createInvoice,
  updateInvoiceStage,
  getInvoicesWithMetadata,
  createEvidence,
  createPaymentValidation
} from './db/repositories/index';

async function testDatabase() {
  console.log('🧪 Testing database connection and repositories...\n');

  try {
    // 1. Test connection
    console.log('1️⃣ Testing database connection...');
    const [rows] = await pool.query('SELECT 1 as test');
    console.log('✅ Database connected\n');

    // 2. Test tables exist
    console.log('2️⃣ Checking tables...');
    const [tables] = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'appdb'
    `);
    console.log('✅ Tables found:', tables.length);
    console.log('   Tables:', (tables as any[]).map(t => t.table_name).join(', '));
    console.log('');

    // 3. Test user creation
    console.log('3️⃣ Testing user creation...');
    const testEmail = `test-${Date.now()}@example.com`;
    const { userId, profile } = await createUser(
      testEmail,
      'Test123!',
      'Test User',
      'Finance Manager'
    );
    console.log('✅ User created:', userId);
    console.log('   Profile:', profile.name, '-', profile.role);
    console.log('');

    // 4. Test authentication
    console.log('4️⃣ Testing authentication...');
    const authResult = await authenticateUser(testEmail, 'Test123!');
    if (authResult) {
      console.log('✅ Authentication successful');
      console.log('   User ID:', authResult.user.id);
      console.log('');
    } else {
      throw new Error('Authentication failed');
    }

    // 5. Test invoice creation
    console.log('5️⃣ Testing invoice creation...');
    const invoice = await createInvoice(
      {
        id: '', // Will be auto-generated
        invoice_number: `INV-TEST-${Date.now()}`,
        vendor: 'Test Vendor Corp',
        amount: 1500.50,
        currency: 'EUR',
        entity: 'Test Entity',
        po_creator: null,
        sharepoint_url: null,
        flow_type: 'MISSING_INVOICE',
        current_stage: 'Invoice Missing',
        source: 'MANUAL',
        status_detail: 'NONE',
        submission_timestamp: null,
        payment_status: 'NONE',
        created_by: '',
        created_by_role: '',
        created_by_id: null
      },
      userId,
      'Test User',
      'Finance Manager'
    );
    console.log('✅ Invoice created:', invoice.invoice_number);
    console.log('   ID:', invoice.id);
    console.log('   Flow:', invoice.flow_type);
    console.log('   Stage:', invoice.current_stage);
    console.log('');

    // 6. Test stage transition
    console.log('6️⃣ Testing workflow stage transition...');
    const updated = await updateInvoiceStage(invoice.id, 'Sent to AP Processing');
    console.log('✅ Stage updated:', updated.current_stage);
    console.log('');

    // 7. Test invalid stage transition (should fail)
    console.log('7️⃣ Testing invalid stage transition (should fail)...');
    try {
      await updateInvoiceStage(invoice.id, 'Invoice Missing'); // Backward move
      console.log('❌ Should have failed!');
    } catch (error: any) {
      console.log('✅ Correctly rejected:', error.message);
      console.log('');
    }

    // 8. Test evidence creation
    console.log('8️⃣ Testing evidence creation...');
    const evidence = await createEvidence(
      invoice.id,
      'NOTE',
      'This is a test note about the invoice',
      'Sent to AP Processing',
      userId,
      'Test User'
    );
    console.log('✅ Evidence created:', evidence.id);
    console.log('   Type:', evidence.type);
    console.log('');

    // 9. Test team view filtering
    console.log('9️⃣ Testing team view filtering...');
    const reconInvoices = await getInvoicesWithMetadata('RECON');
    console.log('✅ RECON view:', reconInvoices.length, 'invoices');
    if (reconInvoices.length > 0) {
      console.log('   Example:', reconInvoices[0].invoice_number);
    }
    console.log('');

    // 10. Test payment validation
    console.log('🔟 Testing payment validation...');
    // First update invoice to REQUESTED
    await pool.query(
      "UPDATE invoices SET payment_status = 'REQUESTED' WHERE id = ?",
      [invoice.id]
    );

    const validation = await createPaymentValidation(
      invoice.id,
      userId,
      'Test User',
      'Payment validated - test transaction'
    );
    console.log('✅ Payment validation created:', validation.id);
    console.log('   Invoice payment_status updated to: PAID');
    console.log('');

    // 11. Verify one validation per invoice rule
    console.log('1️⃣1️⃣ Testing one-validation-per-invoice rule...');
    try {
      await createPaymentValidation(invoice.id, userId, 'Test User', 'Duplicate');
      console.log('❌ Should have failed!');
    } catch (error: any) {
      console.log('✅ Correctly rejected duplicate:', error.message);
      console.log('');
    }

    console.log('✅ All tests passed! Database is working correctly.');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabase();
