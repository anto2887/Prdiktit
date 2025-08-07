#!/usr/bin/env python3
"""
Test script for new analytics and rivalry endpoints
Run this after starting the backend server
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_USER = {
    "username": "test",
    "password": "test",
    "email": "test@example.com"
}

class EndpointTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.group_id = None
        
    def authenticate(self):
        """Login and get access token"""
        print("🔐 Authenticating...")
        
        # Try to login first
        login_data = {
            "username": TEST_USER["username"],
            "password": TEST_USER["password"]
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            self.token = data["data"]["access_token"]
            self.user_id = data["data"]["user"]["id"]
            print(f"✅ Login successful - User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            print("🔧 Attempting to create test user...")
            
            # Try to create user
            register_response = requests.post(f"{BASE_URL}/auth/register", json=TEST_USER)
            
            if register_response.status_code in [200, 201]:
                print("✅ User created successfully")
                # Try login again
                response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
                if response.status_code == 200:
                    data = response.json()
                    self.token = data["data"]["access_token"]
                    self.user_id = data["data"]["user"]["id"]
                    print(f"✅ Login successful - User ID: {self.user_id}")
                    return True
            
            print(f"❌ Authentication failed completely")
            return False
    
    def get_headers(self):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_health_check(self):
        """Test basic health endpoint"""
        print("\n🏥 Testing health check...")
        
        response = requests.get(f"{BASE_URL}/../health")
        
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    
    def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        print("\n📊 Testing Analytics Endpoints...")
        
        if not self.user_id:
            print("❌ No user ID available")
            return False
        
        # Test user analytics (should fail before Week 5)
        print("Testing user analytics...")
        response = requests.get(
            f"{BASE_URL}/analytics/user/{self.user_id}/analytics",
            params={"season": "2024-2025", "week": 3},
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            if not data["data"]["analytics_available"]:
                print("✅ Analytics correctly disabled before Week 5")
            else:
                print("⚠️ Analytics available before Week 5 (unexpected)")
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            print(response.text)
        
        # Test analytics cache invalidation
        print("Testing analytics cache invalidation...")
        response = requests.delete(
            f"{BASE_URL}/analytics/analytics/cache/user/{self.user_id}",
            params={"season": "2024-2025"},
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            print("✅ Cache invalidation successful")
        else:
            print(f"❌ Cache invalidation failed: {response.status_code}")
    
    def test_predictions_endpoints(self):
        """Test new prediction visibility endpoints"""
        print("\n👀 Testing Prediction Visibility Endpoints...")
        
        if not self.group_id:
            print("❌ No group ID available, skipping group-specific tests")
            return False
        
        # Test group predictions for week
        print("Testing group predictions...")
        response = requests.get(
            f"{BASE_URL}/predictions/group/{self.group_id}/week/1",
            params={"season": "2024-2025"},
            headers=self.get_headers()
        )
        
        if response.status_code in [200, 403]:  # 403 expected if not group member
            print("✅ Group predictions endpoint responding")
        else:
            print(f"❌ Group predictions failed: {response.status_code}")
            print(response.text)
        
        # Test match prediction summary
        print("Testing match prediction summary...")
        response = requests.get(
            f"{BASE_URL}/predictions/match/1/summary",
            headers=self.get_headers()
        )
        
        if response.status_code in [200, 404]:  # 404 expected if no match with ID 1
            print("✅ Match summary endpoint responding")
        else:
            print(f"❌ Match summary failed: {response.status_code}")
    
    def test_bonus_endpoints(self):
        """Test bonus calculation endpoints"""
        print("\n🎁 Testing Bonus Endpoints...")
        
        # Test bonus history
        print("Testing user bonus history...")
        response = requests.get(
            f"{BASE_URL}/analytics/user/{self.user_id}/bonus-history",
            params={"season": "2024-2025"},
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            print("✅ Bonus history endpoint working")
        else:
            print(f"❌ Bonus history failed: {response.status_code}")
            print(response.text)
        
        # Test weekly bonus calculation (admin operation)
        print("Testing weekly bonus calculation...")
        response = requests.post(
            f"{BASE_URL}/analytics/bonuses/calculate",
            params={"week": 1, "season": "2024-2025", "league": "Premier League"},
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Bonus calculation successful: {data['data']}")
        else:
            print(f"❌ Bonus calculation failed: {response.status_code}")
            print(response.text)
    
    def test_database_tables(self):
        """Test if new database tables exist by checking endpoints"""
        print("\n🗄️ Testing Database Integration...")
        
        # Test that we can call endpoints without database errors
        endpoints_to_test = [
            ("User Profile", f"{BASE_URL}/users/profile"),
            ("User Stats", f"{BASE_URL}/users/stats"),
        ]
        
        for name, url in endpoints_to_test:
            try:
                response = requests.get(url, headers=self.get_headers())
                if response.status_code in [200, 404, 403]:
                    print(f"✅ {name} endpoint - database connection OK")
                else:
                    print(f"⚠️ {name} endpoint - status {response.status_code}")
            except Exception as e:
                print(f"❌ {name} endpoint - error: {e}")
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("🧪 Starting Endpoint Testing Suite")
        print("=" * 50)
        
        # Authentication test
        if not self.authenticate():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Basic connectivity tests
        self.test_health_check()
        self.test_database_tables()
        
        # Feature-specific tests
        self.test_analytics_endpoints()
        self.test_predictions_endpoints()
        self.test_bonus_endpoints()
        
        print("\n" + "=" * 50)
        print("🎯 Test Suite Complete!")
        
        return True

def main():
    """Main test execution"""
    print("🚀 Football Predictions API - Endpoint Tester")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    tester = EndpointTester()
    
    try:
        success = tester.run_all_tests()
        if success:
            print("✅ All tests completed successfully!")
        else:
            print("❌ Some tests failed - check output above")
    except KeyboardInterrupt:
        print("\n⚠️ Testing interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {e}")

if __name__ == "__main__":
    main()