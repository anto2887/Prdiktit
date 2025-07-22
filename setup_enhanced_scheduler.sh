#!/bin/bash
# setup_enhanced_scheduler.sh - Setup Enhanced Smart Scheduler with Persistent Logging

set -e  # Exit on any error

echo "🚀 Setting up Enhanced Smart Scheduler with Persistent Logging..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the project root
if [ ! -f "docker-compose.dev.yml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Project root directory confirmed"

# Step 1: Create persistent logs directory structure
echo ""
echo "📝 Step 1: Setting up persistent logging directories..."

# Create logs directory structure
mkdir -p logs
mkdir -p logs/frontend
mkdir -p logs/archive

# Create log files with proper permissions
touch logs/app.log
touch logs/match_processing_audit.log
touch logs/fixture_monitoring.log
touch logs/frontend/app.log

# Create .gitignore for logs (keep structure, ignore content)
cat > logs/.gitignore << EOF
# Keep log directory structure but ignore log files
*.log
!.gitignore
!.gitkeep

# Keep subdirectories
!frontend/
!archive/
frontend/*.log
archive/*.log
EOF

# Create .gitkeep files to preserve directory structure
touch logs/.gitkeep
touch logs/frontend/.gitkeep
touch logs/archive/.gitkeep

print_status "Log directories created with proper structure"

# Step 2: Backup current docker-compose files
echo ""
echo "💾 Step 2: Backing up current docker-compose files..."

if [ -f "docker-compose.dev.yml" ]; then
    cp docker-compose.dev.yml docker-compose.dev.yml.backup
    print_status "Backed up docker-compose.dev.yml"
fi

if [ -f "docker-compose.yml" ]; then
    cp docker-compose.yml docker-compose.yml.backup
    print_status "Backed up docker-compose.yml"
fi

# Step 3: Check current main.py for old scheduler imports
echo ""
echo "🔍 Step 3: Checking main.py for scheduler integration..."

if grep -q "smart_scheduler" backend/app/main.py; then
    print_warning "Found references to old smart_scheduler in main.py"
    print_info "You'll need to update main.py to use enhanced_smart_scheduler"
fi

if grep -q "enhanced_smart_scheduler" backend/app/main.py; then
    print_status "Enhanced scheduler import found in main.py"
else
    print_warning "Enhanced scheduler import NOT found in main.py"
fi

# Step 4: Verify Enhanced Scheduler file exists
echo ""
echo "🧠 Step 4: Verifying Enhanced Smart Scheduler files..."

if [ -f "backend/app/services/enhanced_smart_scheduler.py" ]; then
    print_status "Enhanced Smart Scheduler file exists"
else
    print_error "Enhanced Smart Scheduler file missing!"
    print_info "Please ensure backend/app/services/enhanced_smart_scheduler.py exists"
fi

# Step 5: Check for required dependencies
echo ""
echo "📦 Step 5: Checking dependencies..."

if grep -q "asyncio" backend/app/services/enhanced_smart_scheduler.py 2>/dev/null; then
    print_status "Asyncio dependency found"
fi

if grep -q "threading" backend/app/services/enhanced_smart_scheduler.py 2>/dev/null; then
    print_status "Threading dependency found"
fi

# Step 6: Create development helper script
echo ""
echo "🔧 Step 6: Creating development helper..."

cat > dev_enhanced.sh << 'EOF'
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
EOF

chmod +x dev_enhanced.sh
print_status "Created dev_enhanced.sh helper script"

# Step 7: Create log rotation script
echo ""
echo "🔄 Step 7: Creating log rotation script..."

cat > scripts/rotate_logs.sh << 'EOF'
#!/bin/bash
# rotate_logs.sh - Rotate Enhanced Scheduler logs

LOG_DIR="logs"
ARCHIVE_DIR="logs/archive"
MAX_SIZE_MB=100

# Function to rotate a log file if it's too large
rotate_if_large() {
    local file=$1
    local max_size_bytes=$((MAX_SIZE_MB * 1024 * 1024))
    
    if [ -f "$file" ] && [ $(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null) -gt $max_size_bytes ]; then
        local timestamp=$(date +"%Y%m%d_%H%M%S")
        local basename=$(basename "$file" .log)
        local archived_name="${basename}_${timestamp}.log"
        
        echo "📦 Rotating $file (>100MB) to archive..."
        mv "$file" "${ARCHIVE_DIR}/${archived_name}"
        touch "$file"  # Create new empty log file
        
        # Compress archived log
        gzip "${ARCHIVE_DIR}/${archived_name}"
        echo "✅ Archived and compressed: ${archived_name}.gz"
    fi
}

# Rotate logs if they exceed size limit
rotate_if_large "${LOG_DIR}/app.log"
rotate_if_large "${LOG_DIR}/match_processing_audit.log"
rotate_if_large "${LOG_DIR}/fixture_monitoring.log"
rotate_if_large "${LOG_DIR}/frontend/app.log"

# Clean up old archives (keep only last 30 days)
find "${ARCHIVE_DIR}" -name "*.gz" -mtime +30 -delete 2>/dev/null || true

echo "✅ Log rotation complete"
EOF

chmod +x scripts/rotate_logs.sh
print_status "Created log rotation script"

# Step 8: Final setup summary
echo ""
echo "🎉 Setup Complete! Enhanced Smart Scheduler with Persistent Logging Ready"
echo ""
print_info "Next Steps:"
echo ""
echo "1. 📝 Update your docker-compose files with the provided versions (with logging volumes)"
echo "2. 🔄 Replace your backend/app/main.py with the fixed version"
echo "3. 🚀 Restart your containers: ./scripts/dev.sh down && ./scripts/dev.sh up"
echo "4. ✅ Verify scheduler: ./dev_enhanced.sh status"
echo "5. 📋 Monitor logs: ./dev_enhanced.sh logs"
echo ""
print_info "Directory structure created:"
echo "├── logs/"
echo "│   ├── app.log                     # Main application logs"
echo "│   ├── match_processing_audit.log  # Processing cycle logs"
echo "│   ├── fixture_monitoring.log      # Fixture monitoring logs"
echo "│   ├── frontend/"
echo "│   │   └── app.log                 # Frontend logs (optional)"
echo "│   └── archive/                    # Rotated log archives"
echo "├── dev_enhanced.sh                 # Enhanced development helper"
echo "└── scripts/rotate_logs.sh          # Log rotation utility"
echo ""
print_info "Enhanced Scheduler Features:"
echo "⚡ High frequency (2min) during live matches"
echo "🔄 Medium frequency (5min) around match times"  
echo "💤 Low frequency (15-30min) during quiet periods"
echo "📡 Proactive fixture monitoring on match days"
echo "🚨 Automatic postponement/venue change detection"
echo "📊 Real-time score updates during matches"
echo "📝 Comprehensive persistent logging"
echo ""
print_status "Setup completed successfully!"

# Check if jq is installed (needed for dev helper)
if ! command -v jq &> /dev/null; then
    print_warning "jq is not installed. Install it for better JSON formatting in dev helper:"
    print_info "  macOS: brew install jq"
    print_info "  Ubuntu: sudo apt-get install jq"
    print_info "  CentOS: sudo yum install jq"
fi