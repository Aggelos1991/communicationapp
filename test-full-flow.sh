#!/bin/bash

# Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "=== 1. Create Invoice ==="
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "FULL-TEST-001",
    "vendor": "Test Vendor",
    "entity": "TEST",
    "amount": 100,
    "currency": "EUR",
    "flow_type": "MISSING_INVOICE",
    "current_stage": "Invoice Missing",
    "payment_status": "NONE",
    "status_detail": "NONE"
  }')

INVOICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ Created invoice: $INVOICE_ID"

echo ""
echo "=== 2. Add Evidence with Attachments ==="
EVIDENCE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/evidence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"invoice_id\": \"$INVOICE_ID\",
    \"type\": \"NOTE\",
    \"content\": \"Test note with attachment\",
    \"stage_added_at\": \"Invoice Missing\",
    \"attachments\": [
      {
        \"name\": \"test-file.pdf\",
        \"url\": \"data:application/pdf;base64,test\",
        \"type\": \"PDF\",
        \"size\": 1024
      }
    ]
  }")

EVIDENCE_ID=$(echo "$EVIDENCE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ Created evidence: $EVIDENCE_ID"

echo ""
echo "=== 3. Get Evidence with Attachments ==="
GET_EVIDENCE=$(curl -s "http://localhost:3000/api/evidence/invoice/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "$GET_EVIDENCE" | python3 -m json.tool 2>/dev/null || echo "$GET_EVIDENCE"

echo ""
echo "=== 4. Delete Invoice ==="
curl -s -w "HTTP Code: %{http_code}\n" -X DELETE "http://localhost:3000/api/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN" -o /dev/null

echo "✅ Invoice deleted"
