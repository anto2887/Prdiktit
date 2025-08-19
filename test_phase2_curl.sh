#!/bin/bash

# Phase 2 Testing Script - Group-Relative Activation System
# Tests all the updated services using curl commands

echo "🚀 Phase 2 Testing: Group-Relative Activation System"
echo "⏰ Started at: $(date)"
echo "🌐 Testing against: https://backend-production-4894.up.railway.app"
echo ""

BASE_URL="https://backend-production-4894.up.railway.app"
API_BASE="$BASE_URL/api/v1"

# Test 1: Verify migration status
echo "🧪 Test 1: Migration Status Check"
echo "=================================="
curl -s -X GET "$API_BASE/admin/test-group-activation-migration" | jq '.'
echo ""

# Test 2: Test Rivalry Service Activation
echo "🧪 Test 2: Rivalry Service Group-Relative Activation"
echo "===================================================="
curl -s -X GET "$API_BASE/admin/test-rivalry-activation" | jq '.'
echo ""

# Test 3: Test Analytics Service Activation
echo "🧪 Test 3: Analytics Service Group-Relative Activation"
echo "======================================================"
curl -s -X GET "$API_BASE/admin/test-analytics-activation" | jq '.'
echo ""

# Test 4: Test Bonus Service Activation
echo "🧪 Test 4: Bonus Service Group-Relative Activation"
echo "=================================================="
curl -s -X GET "$API_BASE/admin/test-bonus-activation" | jq '.'
echo ""

echo "🎉 Phase 2 Testing Complete!"
echo "⏰ Finished at: $(date)"
