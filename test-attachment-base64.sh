#!/bin/bash

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "=== Creating Invoice ==="
INVOICE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoice_number":"BASE64-TEST","vendor":"Test","entity":"TEST","amount":100,"currency":"EUR","flow_type":"MISSING_INVOICE","current_stage":"Invoice Missing","payment_status":"NONE","status_detail":"NONE"}')

INVOICE_ID=$(echo "$INVOICE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ Invoice: $INVOICE_ID"

echo ""
echo "=== Adding Evidence with Base64 Attachment ==="
EVIDENCE=$(curl -s -X POST http://localhost:3000/api/evidence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"invoice_id\": \"$INVOICE_ID\",
    \"type\": \"NOTE\",
    \"content\": \"Test with real base64\",
    \"stage_added_at\": \"Invoice Missing\",
    \"attachments\": [
      {
        \"name\": \"sample.txt\",
        \"url\": \"data:text/plain;base64,SGVsbG8gV29ybGQh\",
        \"type\": \"OTHER\",
        \"size\": 12
      }
    ]
  }")

echo "✅ Evidence created"

echo ""
echo "=== Fetching Evidence with Attachments ==="
curl -s "http://localhost:3000/api/evidence/invoice/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== Checking Database ==="
docker exec mysql-dev mysql -uappuser -papppass -e "SELECT id, name, type, LEFT(url, 30) as url_preview FROM appdb.attachments ORDER BY created_at DESC LIMIT 3;" 2>&1 | grep -v Warning

echo ""
echo "=== Cleanup ==="
curl -s -X DELETE "http://localhost:3000/api/invoices/$INVOICE_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✅ Cleaned up"
