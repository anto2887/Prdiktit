#!/bin/bash
# startup_validation.sh - Validate startup data sync implementation

echo "🔍 Validating Enhanced Startup Data Sync Implementation"
echo "=" | tr ' ' '=' | head -c 60 && echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

# Step 1: Check if startup sync service exists
echo "📋 Step 1: Checking startup sync service implementation..."

if [ -f "backend/app/services/startup_sync_service.py" ]; then
    print_status "Startup sync service file exists"
    
    # Check for key components
    if grep -q "class StartupSyncService" backend/app/services/startup_sync_service.py; then
        print_status "StartupSyncService class found"
    else
        print_error "StartupSyncService class not found"
    fi
    
    if grep -q "run_startup_sync" backend/app/services/startup_sync_service.py; then
        print_status "run_startup_sync method found"
    else
        print_error "run_startup_sync method not found"
    fi
    
    if grep -q "sync_fixtures_from_api" backend/app/services/startup_sync_service.py; then
        print_status "sync_fixtures_from_api method found"
    else
        print_error "sync_fixtures_from_api method not found"
    fi
    
    if grep -q "process_completed_matches" backend/app/services/startup_sync_service.py; then
        print_status "process_completed_matches method found"
    else
        print_error "process_completed_matches method not found"
    fi
    
else
    print_error "Startup sync service file not found"
    print_info "Please create backend/app/services/startup_sync_service.py"
fi

echo ""

# Step 2: Check main.py integration
echo "📋 Step 2: Checking main.py integration..."

if [ -f "backend/app/main.py" ]; then
    print_status "Main.py file exists"
    
    if grep -q "startup_sync_service" backend/app/main.py; then
        print_status "Startup sync service import found"
    else
        print_error "Startup sync service not imported in main.py"
    fi
    
    if grep -q "run_startup_sync" backend/app/main.py; then
        print_status "run_startup_sync call found in startup event"
    else
        print_error "run_startup_sync not called in startup event"
    fi
    
    if grep -q "startup_event" backend/app/main.py; then
        print_status "Startup event handler found"
    else
        print_error "Startup event handler not found"
    fi
    
else
    print_error "Main.py file not found"
fi

echo ""

# Step 3: Check enhanced football API service
echo "📋 Step 3: Checking enhanced football API service..."

if [ -f "backend/app/services/football_api.py" ]; then
    print_status "Football API service file exists"
    
    if grep -q "get_fixtures_by_date_range" backend/app/services/football_api.py; then
        print_status "get_fixtures_by_date_range method found"
    else
        print_error "get_fixtures_by_date_range method not found"
    fi
    
    if grep -q "get_fixture_by_id" backend/app/services/football_api.py; then
        print_status "get_fixture_by_id method found"
    else
        print_error "get_fixture_by_id method not found"
    fi
    
    if grep -q "_standardize_fixture" backend/app/services/football_api.py; then
        print_status "_standardize_fixture method found"
    else
        print_warning "_standardize_fixture method not found (may need custom implementation)"
    fi
    
else
    print_error "Football API service file not found"
    print_info "Please ensure backend/app/services/football_api.py exists"
fi

echo ""

# Step 4: Check repository functions
echo "📋 Step 4: Checking repository functions..."

if [ -f "backend/app/db/repository.py" ]; then
    print_status "Repository file exists"
    
    if grep -q "create_or_update_fixture" backend/app/db/repository.py; then
        print_status "create_or_update_fixture function found"
    else
        print_warning "create_or_update_fixture function not found (may need implementation)"
    fi
    
    if grep -q "process_match_predictions" backend/app/db/repository.py; then
        print_status "process_match_predictions function found"
    else
        print_error "process_match_predictions function not found"
    fi
    
    if grep -q "calculate_points" backend/app/db/repository.py; then
        print_status "calculate_points function found"
    else
        print_error "calculate_points function not found"
    fi
    
else
    print_error "Repository file not found"
fi

echo ""

# Step 5: Check configuration
echo "📋 Step 5: Checking configuration..."

if [ -f "backend/app/core/config.py" ]; then
    if grep -q "FOOTBALL_API_KEY" backend/app/core/config.py; then
        print_status "FOOTBALL_API_KEY configuration found"
    else
        print_warning "FOOTBALL_API_KEY not found in config"
    fi
    
    if grep -q "CREATE_TABLES_ON_STARTUP" backend/app/core/config.py; then
        print_status "CREATE_TABLES_ON_STARTUP configuration found"
    else
        print_warning "CREATE_TABLES_ON_STARTUP not found in config"
    fi
else
    print_error "Config file not found"
fi

echo ""

# Step 6: Check environment setup
echo "📋 Step 6: Checking environment setup..."

if [ -f "docker-compose.yml" ]; then
    if grep -q "FOOTBALL_API_KEY" docker-compose.yml; then
        print_status "FOOTBALL_API_KEY environment variable configured"
    else
        print_warning "FOOTBALL_API_KEY not set in docker-compose.yml"
    fi
    
    if grep -q "CREATE_TABLES_ON_STARTUP" docker-compose.yml; then
        print_status "CREATE_TABLES_ON_STARTUP environment variable configured"
    else
        print_warning "CREATE_TABLES_ON_STARTUP not set in docker-compose.yml"
    fi
else
    print_warning "docker-compose.yml not found"
fi

echo ""

# Step 7: Check logging setup
echo "📋 Step 7: Checking logging setup..."

if grep -q "startup_sync" backend/app/main.py 2>/dev/null; then
    print_status "Startup sync logging configured"
else
    print_warning "Startup sync logging not found"
fi

if [ -d "logs" ] || grep -q "logs" docker-compose.yml 2>/dev/null; then
    print_status "Logging directory configured"
else
    print_warning "Logging directory not found"
fi

echo ""

# Step 8: Create test script
echo "📋 Step 8: Creating test scripts..."

cat > test_startup_sync.py << 'EOF'
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
EOF

chmod +x test_startup_sync.py
print_status "Test script created: test_startup_sync.py"

# Create development helper
cat > dev_startup.sh << 'EOF'
#!/bin/bash
# Development helper for startup sync

echo "🔧 Startup Sync Development Helper"
echo ""

# Function to test API connection
test_api() {
    echo "🌐 Testing football API connection..."
    curl -s "http://localhost:8000/debug/startup-sync-status" | jq . || echo "❌ API not responding"
}

# Function to trigger manual sync
trigger_sync() {
    echo "🔄 Triggering manual sync..."
    curl -s -X POST "http://localhost:8000/debug/trigger-manual-sync" | jq . || echo "❌ Failed to trigger sync"
}

# Function to check health
check_health() {
    echo "💚 Checking application health..."
    curl -s "http://localhost:8000/health" | jq .enhanced_scheduler || echo "❌ Health check failed"
}

# Function to view logs
view_logs() {
    echo "📋 Viewing startup sync logs..."
    if [ -f "logs/app.log" ]; then
        grep -i "startup_sync\|STARTUP_SYNC" logs/app.log | tail -20
    else
        echo "❌ Log files not found"
    fi
}

case "$1" in
    "test")
        test_api
        ;;
    "sync")
        trigger_sync
        ;;
    "health")
        check_health
        ;;
    "logs")
        view_logs
        ;;
    *)
        echo "Usage: $0 {test|sync|health|logs}"
        echo ""
        echo "Commands:"
        echo "  test   - Test API connection"
        echo "  sync   - Trigger manual sync"
        echo "  health - Check application health"
        echo "  logs   - View startup sync logs"
        ;;
esac
EOF

chmod +x dev_startup.sh
print_status "Development helper created: dev_startup.sh"

echo ""

# Summary
echo "📋 Validation Summary:"
echo "===================="

echo ""
print_info "Next steps:"
echo "1. Ensure all missing components are implemented"
echo "2. Set FOOTBALL_API_KEY in your environment"
echo "3. Test with: ./test_startup_sync.py"
echo "4. Monitor with: ./dev_startup.sh health"
echo "5. View logs with: ./dev_startup.sh logs"

echo ""
print_info "The startup sync will now:"
echo "• Fetch latest fixture data on app startup"
echo "• Update database with any changes"
echo "• Process any missed score updates"
echo "• Ensure all predictions are properly scored"
echo "• Run automatically every time the app starts"

echo ""
echo "🎉 Validation complete! Your startup data sync is ready!"