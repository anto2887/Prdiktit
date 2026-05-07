#!/usr/bin/env python3
"""
Test script for the OAuth migration endpoints
This script will test the migration endpoints to fix the OAuth callback errors
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"  # Adjust if your backend runs on a different port
ADMIN_ENDPOINTS = {
    "test_updated_at": "/api/v1/admin/test-users-updated-at",
    "migrate_updated_at": "/api/v1/admin/migrate-users-updated-at",
    "migrate_all_oauth": "/api/v1/admin/migrate-all-oauth-system",
    "test_session_system": "/api/v1/admin/test-session-system"
}

def test_endpoint(endpoint, method="GET", data=None):
    """Test an endpoint and return the response"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data)
        else:
            print(f"❌ Unsupported method: {method}")
            return None
            
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ {method} {endpoint} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def test_oauth_migration():
    """Test the OAuth migration endpoints"""
    print("🚀 Testing OAuth Migration Endpoints")
    print("=" * 50)
    
    # Step 1: Check current status
    print("\n📋 Step 1: Checking current users updated_at status...")
    status_result = test_endpoint(ADMIN_ENDPOINTS["test_updated_at"])
    
    if status_result:
        if status_result.get("has_updated_at"):
            print("✅ Users table already has updated_at column")
            print(f"   Null values: {status_result.get('null_values_count', 0)}")
            return True
        else:
            print("❌ Users table missing updated_at column")
            print("   Need to run migration")
    else:
        print("❌ Failed to check status")
        return False
    
    # Step 2: Run the migration
    print("\n📋 Step 2: Running users updated_at migration...")
    migration_result = test_endpoint(
        ADMIN_ENDPOINTS["migrate_updated_at"], 
        method="POST"
    )
    
    if migration_result and migration_result.get("success"):
        print("✅ Migration completed successfully!")
        print(f"   Changes: {', '.join(migration_result.get('changes', []))}")
    else:
        print("❌ Migration failed!")
        if migration_result:
            print(f"   Error: {migration_result.get('detail', 'Unknown error')}")
        return False
    
    # Step 3: Verify the migration
    print("\n📋 Step 3: Verifying migration...")
    time.sleep(2)  # Give database a moment to settle
    
    verify_result = test_endpoint(ADMIN_ENDPOINTS["test_updated_at"])
    
    if verify_result and verify_result.get("has_updated_at"):
        print("✅ Migration verified successfully!")
        print(f"   Null values: {verify_result.get('null_values_count', 0)}")
    else:
        print("❌ Migration verification failed!")
        return False
    
    # Step 4: Test comprehensive migration
    print("\n📋 Step 4: Testing comprehensive OAuth migration...")
    comprehensive_result = test_endpoint(
        ADMIN_ENDPOINTS["migrate_all_oauth"], 
        method="POST"
    )
    
    if comprehensive_result and comprehensive_result.get("success"):
        print("✅ Comprehensive migration completed successfully!")
        steps_completed = comprehensive_result.get("steps_completed", 0)
        total_steps = comprehensive_result.get("total_steps", 0)
        print(f"   Steps completed: {steps_completed}/{total_steps}")
    else:
        print("❌ Comprehensive migration failed!")
        if comprehensive_result:
            print(f"   Error: {comprehensive_result.get('detail', 'Unknown error')}")
    
    return True

def test_session_system():
    """Test the session system"""
    print("\n🧪 Testing Session System...")
    print("=" * 30)
    
    session_result = test_endpoint(ADMIN_ENDPOINTS["test_session_system"])
    
    if session_result and session_result.get("success"):
        print("✅ Session system test completed successfully!")
        tests = session_result.get("tests", {})
        
        for test_name, test_result in tests.items():
            status = "✅" if test_result.get("status") == "success" else "❌"
            print(f"   {status} {test_name}: {test_result.get('message', 'N/A')}")
    else:
        print("❌ Session system test failed!")
        if session_result:
            print(f"   Error: {session_result.get('detail', 'Unknown error')}")

def main():
    """Main test function"""
    print("🧪 OAuth Migration Test Script")
    print("=" * 40)
    
    try:
        # Test OAuth migration
        if test_oauth_migration():
            print("\n🎉 OAuth migration test completed successfully!")
        else:
            print("\n💥 OAuth migration test failed!")
            return
        
        # Test session system
        test_session_system()
        
        print("\n🎯 All tests completed!")
        print("\n📝 Next steps:")
        print("   1. Try OAuth login again")
        print("   2. Check if the 'updated_at column does not exist' error is resolved")
        print("   3. Monitor logs for any remaining OAuth issues")
        
    except KeyboardInterrupt:
        print("\n⏹️ Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")

if __name__ == "__main__":
    main()
