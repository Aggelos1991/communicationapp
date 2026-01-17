#!/bin/bash

# Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not get token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "=== Creating test invoice ==="
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "TEST-NOW-001",
    "vendor": "Test Vendor",
    "entity": "TEST",
    "amount": 100,
    "currency": "EUR",
    "flow_type": "MISSING_INVOICE",
    "current_stage": "Invoice Missing",
    "payment_status": "NONE",
    "status_detail": "NONE"
  }')

ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Created invoice with ID: $ID"

echo ""
echo "=== Attempting DELETE ==="
DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "http://localhost:3000/api/invoices/$ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$DELETE_RESPONSE"

echo ""
echo "=== Verifying deletion ==="
GET_RESPONSE=$(curl -s "http://localhost:3000/api/invoices/$ID" \
  -H "Authorization: Bearer $TOKEN")
echo "$GET_RESPONSE"
