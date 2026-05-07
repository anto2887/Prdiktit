#!/usr/bin/env python3
"""
Test script for the group_id migration endpoint
"""

import requests
import json

# Configuration
API_BASE_URL = "https://backend-production-4894.up.railway.app/api/v1"
# You'll need to get a valid access token from your frontend
ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"  # Replace with actual token

def test_migration_endpoint():
    """Test the migration endpoint"""
    
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Test migration endpoint
    print("🚀 Testing group_id migration endpoint...")
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/predictions/migrate-group-id-field",
            headers=headers
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Migration successful!")
            print(f"Migration ID: {data.get('data', {}).get('migration_id')}")
            print(f"Records processed: {data.get('data', {}).get('records_processed')}")
            print(f"Records updated: {data.get('data', {}).get('records_updated')}")
        else:
            print("❌ Migration failed!")
            
    except Exception as e:
        print(f"❌ Error testing migration: {e}")

def test_leaderboard_endpoint():
    """Test the leaderboard endpoint after migration"""
    
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Test leaderboard endpoint
    print("\n🔍 Testing leaderboard endpoint...")
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/predictions/leaderboard/1?season=2025",
            headers=headers
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Leaderboard working!")
        else:
            print("❌ Leaderboard still broken!")
            
    except Exception as e:
        print(f"❌ Error testing leaderboard: {e}")

if __name__ == "__main__":
    print("🧪 Group ID Migration Test Script")
    print("=" * 40)
    
    if ACCESS_TOKEN == "YOUR_ACCESS_TOKEN_HERE":
        print("❌ Please set a valid ACCESS_TOKEN before running this script")
        print("   You can get this from your frontend's localStorage or browser dev tools")
    else:
        test_migration_endpoint()
        test_leaderboard_endpoint()
    
    print("\n✨ Test script completed!")
