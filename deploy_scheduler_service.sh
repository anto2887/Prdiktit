#!/bin/bash

# Deploy Scheduler Service Script
# This script helps deploy the new backend-scheduler service

set -e

echo "🚀 Deploying Backend Scheduler Service"
echo "======================================"

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
    
    # Check if we're in the right directory
    if [ ! -f "backend/Dockerfile.scheduler" ]; then
        print_error "Dockerfile.scheduler not found. Please run this script from the project root."
        exit 1
    fi
    
    if [ ! -f "backend/railway.scheduler.json" ]; then
        print_error "railway.scheduler.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Deploy to Railway
    print_status "Building and deploying scheduler service..."
    railway up --service backend-scheduler
    
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
    echo "   - Create new service: 'backend-scheduler'"
    echo "   - Source: Same GitHub repo"
    echo "   - Root Directory: backend/"
    echo "   - Branch: production"
    echo ""
    echo "2. ⚙️ Configure Service:"
    echo "   - Port: 8001"
    echo "   - Start Command: python -m app.scheduler_health"
    echo "   - Dockerfile: Dockerfile.scheduler"
    echo "   - Resources: 2-4 vCPU, 4-8 GB RAM"
    echo ""
    echo "3. 🔑 Environment Variables:"
    echo "   - Copy ALL environment variables from main backend service"
    echo "   - Database connections, API keys, etc."
    echo ""
    echo "4. 🚀 Deploy:"
    echo "   - Railway will auto-deploy when you push to production branch"
    echo "   - Or use: railway up --service backend-scheduler"
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
    echo "📚 For detailed instructions, see: backend/SCHEDULER_SERVICE_README.md"
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
    print_warning "Remember: You need to create the backend-scheduler service manually in Railway dashboard first!"
}

# Run main function
main "$@"
