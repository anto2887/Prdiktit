#!/bin/bash
# scripts/dev.sh - Development helper scripts

# Start development environment
dev_up() {
    echo "🚀 Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    echo "✅ Development environment started!"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔧 Backend: http://localhost:8000"
    echo "📊 Backend Docs: http://localhost:8000/docs"
}

# Stop development environment
dev_down() {
    echo "🛑 Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    echo "✅ Development environment stopped!"
}

# Restart just the frontend (for when you need to rebuild)
frontend_restart() {
    echo "🔄 Restarting frontend..."
    docker-compose -f docker-compose.dev.yml restart frontend
    echo "✅ Frontend restarted!"
}

# Restart just the backend
backend_restart() {
    echo "🔄 Restarting backend..."
    docker-compose -f docker-compose.dev.yml restart backend
    echo "✅ Backend restarted!"
}

# View logs for a specific service
dev_logs() {
    if [ -z "$1" ]; then
        echo "📋 Showing all logs..."
        docker-compose -f docker-compose.dev.yml logs -f
    else
        echo "📋 Showing logs for $1..."
        docker-compose -f docker-compose.dev.yml logs -f "$1"
    fi
}

# Rebuild and restart a service
dev_rebuild() {
    if [ -z "$1" ]; then
        echo "❌ Please specify a service: frontend, backend, or all"
        return 1
    fi
    
    if [ "$1" = "all" ]; then
        echo "🔨 Rebuilding all services..."
        docker-compose -f docker-compose.dev.yml down
        docker-compose -f docker-compose.dev.yml build
        docker-compose -f docker-compose.dev.yml up -d
    else
        echo "🔨 Rebuilding $1..."
        docker-compose -f docker-compose.dev.yml stop "$1"
        docker-compose -f docker-compose.dev.yml build "$1"
        docker-compose -f docker-compose.dev.yml up -d "$1"
    fi
    echo "✅ Rebuild complete!"
}

# Clean up everything (including volumes)
dev_clean() {
    echo "🧹 Cleaning up development environment..."
    docker-compose -f docker-compose.dev.yml down -v
    docker system prune -f
    echo "✅ Cleanup complete!"
}

# Show status of all services
dev_status() {
    echo "📊 Development environment status:"
    docker-compose -f docker-compose.dev.yml ps
}

# Enter a service container for debugging
dev_shell() {
    if [ -z "$1" ]; then
        echo "❌ Please specify a service: frontend, backend, db, or redis"
        return 1
    fi
    
    echo "🐚 Opening shell in $1..."
    docker-compose -f docker-compose.dev.yml exec "$1" sh
}

# Main script logic
case "$1" in
    "up"|"start")
        dev_up
        ;;
    "down"|"stop")
        dev_down
        ;;
    "restart-frontend"|"rf")
        frontend_restart
        ;;
    "restart-backend"|"rb")
        backend_restart
        ;;
    "logs")
        dev_logs "$2"
        ;;
    "rebuild")
        dev_rebuild "$2"
        ;;
    "clean")
        dev_clean
        ;;
    "status"|"ps")
        dev_status
        ;;
    "shell")
        dev_shell "$2"
        ;;
    *)
        echo "🔧 Football Predictions Development Helper"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  up|start              Start development environment"
        echo "  down|stop             Stop development environment"
        echo "  restart-frontend|rf   Restart only frontend service"
        echo "  restart-backend|rb    Restart only backend service"
        echo "  logs [service]        Show logs (all services or specific)"
        echo "  rebuild [service]     Rebuild and restart service"
        echo "  clean                 Stop and clean everything"
        echo "  status|ps             Show service status"
        echo "  shell [service]       Open shell in service container"
        echo ""
        echo "Examples:"
        echo "  $0 up                 # Start everything"
        echo "  $0 logs frontend      # Show frontend logs"
        echo "  $0 rebuild backend    # Rebuild backend"
        echo "  $0 shell frontend     # Open shell in frontend"
        ;;
esac