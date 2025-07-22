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
