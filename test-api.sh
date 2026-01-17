#!/bin/bash

# First, login to get a token
echo "=== Testing Login ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

echo "Login Response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "No token found. Creating user first..."
  
  REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123","name":"Test User"}')
  
  echo "Register Response: $REGISTER_RESPONSE"
  TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

echo "Token: $TOKEN"
echo ""

# Get all invoices
echo "=== Getting All Invoices ==="
curl -s -X GET http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo ""
echo "=== Creating a Test Invoice ==="
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "TEST-DELETE-001",
    "vendor": "Test Vendor",
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
echo "Created Invoice ID: $INVOICE_ID"

echo ""
echo "=== Deleting Invoice $INVOICE_ID ==="
curl -s -X DELETE "http://localhost:3000/api/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "=== Verifying Deletion ==="
curl -s -X GET http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" | jq '.'
