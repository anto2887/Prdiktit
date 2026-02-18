#!/bin/bash

# Scheduler Build Script
# Automatically detects backend structure changes and updates Dockerfile if needed
# This script ensures the scheduler Dockerfile always copies the right files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
SCHEDULER_DIR="$SCRIPT_DIR"
DOCKERFILE="$SCHEDULER_DIR/Dockerfile"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Analyzing backend structure for scheduler dependencies...${NC}"

# Function to check if a directory exists
check_dir() {
    [ -d "$1" ]
}

# Function to check if a file exists
check_file() {
    [ -f "$1" ]
}

# Detect what the scheduler actually needs by analyzing imports
detect_dependencies() {
    local deps=()
    
    # Core app directory (always needed)
    if check_dir "$BACKEND_DIR/app"; then
        deps+=("app")
    fi
    
    # Check for additional directories that might be needed
    # Based on scheduler_minimal.py imports and common patterns
    
    # Scripts directory (might be needed for migrations/utilities)
    if check_dir "$BACKEND_DIR/scripts"; then
        deps+=("scripts")
    fi
    
    # Data directory (for JSON files, configs, etc.)
    if check_dir "$BACKEND_DIR/data"; then
        deps+=("data")
    fi
    
    # Lambda directory (if scheduler uses lambda functions)
    if check_dir "$BACKEND_DIR/lambda"; then
        deps+=("lambda")
    fi
    
    # Check for any .env or config files at backend root
    if check_file "$BACKEND_DIR/.env.example" || check_file "$BACKEND_DIR/config.json"; then
        deps+=("config_files")
    fi
    
    echo "${deps[@]}"
}

# Validate that required directories exist before building
validate_dependencies() {
    local missing=()
    
    # App directory is always required
    if [ ! -d "$BACKEND_DIR/app" ]; then
        missing+=("backend/app")
    fi
    
    # Check optional directories - warn if Dockerfile tries to copy non-existent dirs
    if grep -q "COPY backend/scripts" "$DOCKERFILE" && [ ! -d "$BACKEND_DIR/scripts" ]; then
        echo -e "${YELLOW}⚠️  Warning: Dockerfile copies backend/scripts but directory doesn't exist${NC}"
        echo -e "${YELLOW}   Consider removing that COPY line or creating the directory${NC}"
    fi
    
    if grep -q "COPY backend/data" "$DOCKERFILE" && [ ! -d "$BACKEND_DIR/data" ]; then
        echo -e "${YELLOW}⚠️  Warning: Dockerfile copies backend/data but directory doesn't exist${NC}"
        echo -e "${YELLOW}   Consider removing that COPY line or creating the directory${NC}"
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${YELLOW}❌ Missing required directories: ${missing[*]}${NC}"
        return 1
    fi
    
    return 0
}

# Update Dockerfile with detected dependencies
update_dockerfile() {
    local deps=$(detect_dependencies)
    
    echo -e "${YELLOW}📝 Detected dependencies: ${deps}${NC}"
    echo -e "${BLUE}🔄 Checking Dockerfile structure...${NC}"
    
    # Check if Dockerfile needs updates
    local needs_update=false
    
    # Check if scripts directory exists but isn't in Dockerfile
    if check_dir "$BACKEND_DIR/scripts" && ! grep -q "COPY backend/scripts" "$DOCKERFILE"; then
        echo -e "${YELLOW}💡 Suggestion: Add 'COPY backend/scripts ./scripts' to Dockerfile${NC}"
        needs_update=true
    fi
    
    # Check if data directory exists but isn't in Dockerfile
    if check_dir "$BACKEND_DIR/data" && ! grep -q "COPY backend/data" "$DOCKERFILE"; then
        echo -e "${YELLOW}💡 Suggestion: Add 'COPY backend/data ./data' to Dockerfile${NC}"
        needs_update=true
    fi
    
    if [ "$needs_update" = false ]; then
        echo -e "${GREEN}✅ Dockerfile is up to date${NC}"
    else
        echo -e "${YELLOW}⚠️  Manual update recommended - see suggestions above${NC}"
    fi
}

# Main build function
build() {
    echo -e "${BLUE}🚀 Building scheduler service...${NC}"
    
    # Check if backend directory exists
    if [ ! -d "$BACKEND_DIR" ]; then
        echo -e "${YELLOW}❌ Backend directory not found at $BACKEND_DIR${NC}"
        exit 1
    fi
    
    # Validate dependencies before building
    if ! validate_dependencies; then
        echo -e "${YELLOW}❌ Dependency validation failed${NC}"
        exit 1
    fi
    
    # Detect dependencies
    local deps=$(detect_dependencies)
    echo -e "${GREEN}✅ Dependencies detected: ${deps}${NC}"
    
    # Build Docker image
    # Build context must be project root to access backend/
    cd "$PROJECT_ROOT"
    
    echo -e "${BLUE}🐳 Building Docker image (context: $PROJECT_ROOT)...${NC}"
    docker build \
        -f "$DOCKERFILE" \
        -t scheduler:latest \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        .
    
    echo -e "${GREEN}✅ Build complete!${NC}"
    echo -e "${BLUE}💡 To run: docker run -p 8001:8001 scheduler:latest${NC}"
}

# Validate Dockerfile structure
validate_dockerfile() {
    echo -e "${BLUE}🔍 Validating Dockerfile structure...${NC}"
    
    if ! check_file "$DOCKERFILE"; then
        echo -e "${YELLOW}❌ Dockerfile not found at $DOCKERFILE${NC}"
        exit 1
    fi
    
    # Check if required COPY commands exist
    if ! grep -q "COPY backend/app" "$DOCKERFILE"; then
        echo -e "${YELLOW}⚠️  Warning: Dockerfile missing COPY backend/app command${NC}"
    fi
    
    echo -e "${GREEN}✅ Dockerfile structure validated${NC}"
}

# Show detected structure
show_structure() {
    echo -e "${BLUE}📊 Backend Structure Analysis:${NC}"
    echo ""
    echo "Required (always):"
    echo "  ✓ backend/app/          - Core application code"
    echo ""
    echo "Optional (detected):"
    
    if check_dir "$BACKEND_DIR/scripts"; then
        echo "  ✓ backend/scripts/      - Utility scripts"
    else
        echo "  ✗ backend/scripts/      - Not found"
    fi
    
    if check_dir "$BACKEND_DIR/data"; then
        echo "  ✓ backend/data/        - Data files"
    else
        echo "  ✗ backend/data/        - Not found"
    fi
    
    if check_dir "$BACKEND_DIR/lambda"; then
        echo "  ✓ backend/lambda/      - Lambda functions"
    else
        echo "  ✗ backend/lambda/      - Not found"
    fi
    
    echo ""
    echo -e "${BLUE}Current Dockerfile copies:${NC}"
    grep "^COPY backend" "$DOCKERFILE" || echo "  (none found)"
}

# Main script logic
case "${1:-build}" in
    "build")
        validate_dockerfile
        build
        ;;
    "analyze")
        show_structure
        deps=$(detect_dependencies)
        echo ""
        echo -e "${GREEN}Detected dependencies: ${deps}${NC}"
        ;;
    "update")
        update_dockerfile
        ;;
    "validate")
        validate_dockerfile
        show_structure
        ;;
    *)
        echo "Usage: $0 [build|analyze|update|validate]"
        echo ""
        echo "Commands:"
        echo "  build     - Build the scheduler Docker image (default)"
        echo "  analyze   - Analyze backend structure and show dependencies"
        echo "  update    - Update Dockerfile based on detected changes"
        echo "  validate  - Validate Dockerfile and show structure"
        exit 1
        ;;
esac
