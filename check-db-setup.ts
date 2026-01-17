/**
 * Database Setup Checker
 * Run this to verify your Supabase database is configured correctly
 */

import { supabase } from './lib/supabase';

async function checkDatabaseSetup() {
  console.log('🔍 Checking Supabase Database Setup...\n');

  // 1. Check authentication
  console.log('1. Checking Authentication...');
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError) {
    console.error('❌ Auth Error:', authError.message);
  } else if (!session) {
    console.log('⚠️  No active session found');
  } else {
    console.log('✅ Session found for user:', session.user.email);
    console.log('   User ID:', session.user.id);
  }

  // 2. Check if invoices table exists and is accessible
  console.log('\n2. Checking Invoices Table...');
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id')
    .limit(1);

  if (invoicesError) {
    console.error('❌ Invoices Table Error:', invoicesError.message);
    console.error('   Code:', invoicesError.code);
    console.error('   Details:', invoicesError.details);
    console.error('   Hint:', invoicesError.hint);
  } else {
    console.log('✅ Invoices table is accessible');
    console.log('   Current invoice count:', invoices?.length || 0);
  }

  // 3. Check if profiles table exists
  console.log('\n3. Checking Profiles Table...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .limit(5);

  if (profilesError) {
    console.error('❌ Profiles Table Error:', profilesError.message);
  } else {
    console.log('✅ Profiles table is accessible');
    console.log('   Profiles found:', profiles?.length || 0);
    if (profiles && profiles.length > 0) {
      console.log('   Sample profiles:', profiles);
    }
  }

  // 4. Check if views exist
  console.log('\n4. Checking Invoices With Metadata View...');
  const { data: metadata, error: metadataError } = await supabase
    .from('invoices_with_metadata')
    .select('id')
    .limit(1);

  if (metadataError) {
    console.error('❌ View Error:', metadataError.message);
  } else {
    console.log('✅ invoices_with_metadata view is accessible');
  }

  // 5. Try to test RLS by attempting an insert (will fail gracefully)
  console.log('\n5. Testing RLS Policies...');
  if (session) {
    const testInvoice = {
      invoice_number: 'TEST-' + Date.now(),
      vendor: 'Test Vendor',
      flow_type: 'MISSING_INVOICE',
      current_stage: 'Invoice Missing',
      created_by: session.user.email || 'test@test.com',
      created_by_role: 'Test',
      created_by_id: session.user.id,
    };

    const { data: insertData, error: insertError } = await supabase
      .from('invoices')
      .insert(testInvoice)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert Test Failed:', insertError.message);
      console.error('   Code:', insertError.code);
      console.error('   This indicates RLS policies may need to be set up');
    } else {
      console.log('✅ Insert test succeeded!');
      console.log('   Created invoice:', insertData.id);

      // Clean up test invoice
      await supabase.from('invoices').delete().eq('id', insertData.id);
      console.log('   Test invoice cleaned up');
    }
  } else {
    console.log('⚠️  Skipping insert test (no active session)');
    console.log('   Please log in first to test RLS policies');
  }

  console.log('\n✅ Database check complete!');
  console.log('\n📋 Next Steps:');

  if (!session) {
    console.log('   1. Make sure you are logged in to the application');
  }

  if (invoicesError?.code === '42501') {
    console.log('   1. Run the supabase-schema.sql file in your Supabase SQL Editor');
    console.log('   2. Make sure RLS policies are enabled');
    console.log('   3. Verify that the authenticated role has the correct permissions');
  }
}

checkDatabaseSetup().catch(console.error);
