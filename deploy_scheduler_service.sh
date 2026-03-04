#!/bin/bash

# Deploy Scheduler Service Script
# This script helps deploy the scheduler service

set -e

echo "🚀 Deploying Scheduler Service"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Railway CLI is installed
check_railway_cli() {
    print_status "Checking Railway CLI installation..."
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI not found. Installing..."
        npm install -g @railway/cli
    else
        print_success "Railway CLI found"
    fi
}

# Check if user is logged in to Railway
check_railway_auth() {
    print_status "Checking Railway authentication..."
    if ! railway whoami &> /dev/null; then
        print_warning "Not logged in to Railway. Please login:"
        railway login
    else
        print_success "Authenticated with Railway"
    fi
}

# Check if project is linked
check_project_link() {
    print_status "Checking project link..."
    if [ ! -f ".railway" ]; then
        print_warning "Project not linked. Please link your project:"
        railway link
    else
        print_success "Project linked"
    fi
}

# Deploy scheduler service
deploy_scheduler_service() {
    print_status "Deploying scheduler service..."
    
    if [ ! -f "railway.toml" ]; then
        print_error "railway.toml not found. Please run this script from the project root."
        exit 1
    fi
    
    # Verify scheduler build config is present in railway.toml
    if ! grep -q '\[scheduler.build\]' railway.toml; then
        print_error "Scheduler build configuration not found in railway.toml. Please configure [scheduler.build] first."
        exit 1
    fi
    
    # Deploy to Railway
    print_status "Building and deploying scheduler service..."
    railway up --service scheduler
    
    print_success "Scheduler service deployment initiated"
}

# Show next steps
show_next_steps() {
    echo ""
    echo "🎯 Next Steps:"
    echo "==============="
    echo ""
    echo "1. 📋 Create Railway Service:"
    echo "   - Go to Railway dashboard"
    echo "   - Create new service: 'scheduler'"
    echo "   - Source: Same GitHub repo"
    echo "   - Root Directory: / (project root)"
    echo "   - Branch: production"
    echo ""
    echo "2. ⚙️ Configure Service:"
    echo "   - Configuration is managed by railway.toml (config-as-code)"
    echo "   - Port: 8001 (set via PORT environment variable)"
    echo "   - Start Command: python -m app.scheduler_minimal"
    echo "   - Dockerfile: backend/Dockerfile.prod (shared with backend service)"
    echo "   - Resources: 2-4 vCPU, 4-8 GB RAM"
    echo "   - Note: Clear any dashboard build settings to let railway.toml take precedence"
    echo ""
    echo "3. 🔑 Environment Variables:"
    echo "   - Copy ALL environment variables from main backend service"
    echo "   - Database connections, API keys, etc."
    echo ""
    echo "4. 🚀 Deploy:"
    echo "   - Railway will auto-deploy when you push to production branch"
    echo "   - Or use: railway up --service scheduler"
    echo "   - Or use this script: ./deploy_scheduler_service.sh"
    echo ""
    echo "5. ✅ Verify:"
    echo "   - Check health endpoint: /health"
    echo "   - Check status endpoint: /status"
    echo "   - Monitor logs for scheduler activity"
    echo ""
    echo "6. 🔄 Deploy Updated Backend:"
    echo "   - Deploy main backend service with scheduler removed"
    echo "   - Verify HTTP endpoints still work"
    echo "   - Verify no scheduler processes running"
    echo ""
    echo "📚 Configuration:"
    echo "   - railway.toml: Main service configuration"
    echo "   - backend/Dockerfile.prod: Shared backend/scheduler Docker image"
}

# Main execution
main() {
    echo "Starting deployment process..."
    
    # Check prerequisites
    check_railway_cli
    check_railway_auth
    check_project_link
    
    # Show next steps
    show_next_steps
    
    print_success "Deployment script completed successfully!"
    echo ""
    print_warning "Remember: You need to create the 'scheduler' service manually in Railway dashboard first!"
    print_warning "Important: Set Root Directory to '/' (project root) to use railway.toml configuration"
}

# Run main function
main "$@"
