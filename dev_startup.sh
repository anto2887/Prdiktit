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
