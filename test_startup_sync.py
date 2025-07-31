#!/usr/bin/env python3
"""
Test script for startup sync functionality
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

async def test_startup_sync():
    """Test the startup sync service"""
    try:
        from app.services.startup_sync_service import startup_sync_service
        
        print("🧪 Testing startup sync service...")
        
        # Test the sync process
        results = await startup_sync_service.run_startup_sync()
        
        print(f"✅ Startup sync test completed!")
        print(f"   Status: {results['status']}")
        print(f"   Fixtures added: {results.get('fixtures_added', 0)}")
        print(f"   Fixtures updated: {results.get('fixtures_updated', 0)}")
        print(f"   Matches processed: {results.get('matches_processed', 0)}")
        print(f"   Predictions processed: {results.get('predictions_processed', 0)}")
        print(f"   Duration: {results.get('duration_seconds', 0):.2f}s")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_startup_sync())
    sys.exit(0 if success else 1)
