#!/bin/bash

# Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create invoice and evidence first
INVOICE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoice_number":"ATT-TEST","vendor":"Test","entity":"TEST","amount":100,"currency":"EUR","flow_type":"MISSING_INVOICE","current_stage":"Invoice Missing","payment_status":"NONE","status_detail":"NONE"}')

INVOICE_ID=$(echo "$INVOICE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

EVIDENCE=$(curl -s -X POST http://localhost:3000/api/evidence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE_ID\",\"type\":\"NOTE\",\"content\":\"Test\",\"stage_added_at\":\"Invoice Missing\"}")

EVIDENCE_ID=$(echo "$EVIDENCE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Evidence ID: $EVIDENCE_ID"
echo ""
echo "=== Creating Attachment Directly ==="
ATTACHMENT=$(curl -s -X POST http://localhost:3000/api/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"test.pdf\",\"url\":\"data:application/pdf;base64,test\",\"type\":\"PDF\",\"size\":1024,\"evidence_id\":\"$EVIDENCE_ID\"}")

echo "$ATTACHMENT" | python3 -m json.tool 2>/dev/null || echo "$ATTACHMENT"

# Cleanup
curl -s -X DELETE "http://localhost:3000/api/invoices/$INVOICE_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
