#!/usr/bin/env python3
"""
Phase 2 Testing Script - Group-Relative Activation System
Tests all the updated services to ensure they work correctly with the new activation system
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://backend-production-4894.up.railway.app"
API_BASE = f"{BASE_URL}/api/v1"

def test_endpoint(endpoint, method="GET", data=None):
    """Test an API endpoint and return results"""
    url = f"{API_BASE}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data or {})
        else:
            return {"error": f"Unsupported method: {method}"}
        
        if response.status_code == 200:
            return {
                "success": True,
                "status_code": response.status_code,
                "data": response.json()
            }
        else:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": response.text
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def print_test_result(test_name, result):
    """Print test results in a formatted way"""
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")
    
    if result.get("success"):
        print(f"✅ SUCCESS (Status: {result.get('status_code', 'N/A')})")
        if "data" in result:
            data = result["data"]
            if "message" in data:
                print(f"📝 Message: {data['message']}")
            if "test_results" in data:
                print(f"📊 Test Results: {len(data['test_results'])} groups tested")
                for group_result in data['test_results']:
                    print(f"   📍 Group {group_result['group_id']}: {group_result['group_name']}")
                    if 'week_tests' in group_result:
                        for week_test in group_result['week_tests']:
                            status = "✅" if week_test.get('is_rivalry_week') or week_test.get('available') or week_test.get('bonus_available') else "❌"
                            print(f"      {status} Week {week_test['week']}: {week_test}")
    else:
        print(f"❌ FAILED")
        if "error" in result:
            print(f"💥 Error: {result['error']}")
        if "status_code" in result:
            print(f"📡 Status Code: {result['status_code']}")

def main():
    """Run all Phase 2 tests"""
    print("🚀 Phase 2 Testing: Group-Relative Activation System")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Testing against: {BASE_URL}")
    
    # Test 1: Verify migration status
    print_test_result(
        "Migration Status Check",
        test_endpoint("/admin/test-group-activation-migration")
    )
    
    # Test 2: Test Rivalry Service Activation
    print_test_result(
        "Rivalry Service Group-Relative Activation",
        test_endpoint("/admin/test-rivalry-activation")
    )
    
    # Test 3: Test Analytics Service Activation
    print_test_result(
        "Analytics Service Group-Relative Activation",
        test_endpoint("/admin/test-analytics-activation")
    )
    
    # Test 4: Test Bonus Service Activation
    print_test_result(
        "Bonus Service Group-Relative Activation",
        test_endpoint("/admin/test-bonus-activation")
    )
    
    print(f"\n{'='*60}")
    print("🎉 Phase 2 Testing Complete!")
    print(f"⏰ Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
