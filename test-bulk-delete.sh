#!/bin/bash

# Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "=== Creating Multiple Test Invoices ==="
IDS=()

for i in {1..3}; do
  CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"invoice_number\": \"TEST-BULK-00$i\",
      \"vendor\": \"Test Vendor $i\",
      \"entity\": \"TEST-ENTITY\",
      \"amount\": $((100 * i)).50,
      \"currency\": \"EUR\",
      \"flow_type\": \"MISSING_INVOICE\",
      \"current_stage\": \"Invoice Missing\",
      \"payment_status\": \"NONE\",
      \"status_detail\": \"NONE\"
    }")
  
  ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  IDS+=("$ID")
  echo "Created invoice $i with ID: $ID"
done

echo ""
echo "=== Bulk Deleting ${#IDS[@]} Invoices ==="
IDS_JSON=$(printf ',"%s"' "${IDS[@]}")
IDS_JSON="[${IDS_JSON:1}]"
echo "IDs to delete: $IDS_JSON"

BULK_DELETE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices/bulk-delete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ids\": $IDS_JSON}" \
  -w "\nHTTP Status: %{http_code}")

echo "$BULK_DELETE_RESPONSE"

echo ""
echo "=== Verifying Deletion ==="
curl -s -X GET http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" | jq 'map({id, invoice_number, vendor})'
