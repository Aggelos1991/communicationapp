#!/bin/bash

# Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "=== Creating Test Invoice ==="
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "TEST-UPDATE-001",
    "vendor": "Original Vendor",
    "entity": "TEST-ENTITY",
    "amount": 100.50,
    "currency": "EUR",
    "flow_type": "MISSING_INVOICE",
    "current_stage": "Invoice Missing",
    "payment_status": "NONE",
    "status_detail": "NONE"
  }')

echo "$CREATE_RESPONSE" | jq '.'
INVOICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo ""
echo "=== Updating Invoice $INVOICE_ID ==="
UPDATE_RESPONSE=$(curl -s -X PATCH "http://localhost:3000/api/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "Updated Vendor Name",
    "amount": 250.75
  }')

echo "$UPDATE_RESPONSE" | jq '.'

echo ""
echo "=== Updating Stage ==="
STAGE_RESPONSE=$(curl -s -X PATCH "http://localhost:3000/api/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_stage": "Sent to AP Processing"
  }')

echo "$STAGE_RESPONSE" | jq '.'

echo ""
echo "=== Cleaning up ==="
curl -s -X DELETE "http://localhost:3000/api/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN"
echo "Deleted test invoice"
