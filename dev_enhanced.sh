#!/bin/bash
# dev_enhanced.sh - Enhanced development helper with logging

# Function to check Enhanced Scheduler status
check_scheduler_status() {
    echo "🧠 Checking Enhanced Smart Scheduler status..."
    curl -s http://localhost:8000/debug/scheduler-status | jq . || echo "❌ Failed to get scheduler status"
}

# Function to trigger manual processing
trigger_processing() {
    echo "⚡ Triggering manual processing cycle..."
    curl -s -X POST http://localhost:8000/debug/trigger-processing | jq . || echo "❌ Failed to trigger processing"
}

# Function to trigger fixture monitoring
trigger_monitoring() {
    echo "📡 Triggering fixture monitoring..."
    curl -s -X POST http://localhost:8000/debug/trigger-fixture-monitoring | jq . || echo "❌ Failed to trigger monitoring"
}

# Function to view live logs
view_logs() {
    echo "📋 Viewing Enhanced Scheduler logs..."
    if [ -f "logs/app.log" ]; then
        tail -f logs/app.log logs/match_processing_audit.log logs/fixture_monitoring.log
    else
        echo "❌ Log files not found. Make sure containers are running."
    fi
}

# Function to check health
check_health() {
    echo "💚 Checking application health..."
    curl -s http://localhost:8000/health | jq . || echo "❌ Health check failed"
}

# Main menu
case "$1" in
    "status")
        check_scheduler_status
        ;;
    "process")
        trigger_processing
        ;;
    "monitor")
        trigger_monitoring
        ;;
    "logs")
        view_logs
        ;;
    "health")
        check_health
        ;;
    *)
        echo "🔧 Enhanced Smart Scheduler Development Helper"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  status     Check Enhanced Scheduler status"
        echo "  process    Trigger manual processing cycle"
        echo "  monitor    Trigger fixture monitoring"
        echo "  logs       View live logs (all log files)"
        echo "  health     Check application health"
        echo ""
        echo "Examples:"
        echo "  $0 status     # Check scheduler status"
        echo "  $0 logs       # View live logs"
        echo "  $0 monitor    # Test fixture monitoring"
        ;;
esac
