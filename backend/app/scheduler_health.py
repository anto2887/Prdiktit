#!/usr/bin/env python3
"""
Simple Health Check Server for Scheduler Service
Provides a basic HTTP endpoint for Railway health checks
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from aiohttp import web
import json

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import health status function from minimal scheduler
from .scheduler_minimal import get_health_status

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def health_check(request):
    """Health check endpoint for Railway"""
    try:
        health_data = get_health_status()
        return web.json_response(health_data)
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return web.json_response({
            "status": "unhealthy",
            "error": str(e),
            "service": "backend-scheduler"
        }, status=500)

async def status_check(request):
    """Status endpoint for monitoring"""
    try:
        health_data = get_health_status()
        return web.json_response(health_data)
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return web.json_response({
            "status": "error",
            "error": str(e),
            "service": "backend-scheduler"
        }, status=500)

async def init_app():
    """Initialize the health check web application"""
    app = web.Application()
    
    # Add routes
    app.router.add_get('/health', health_check)
    app.router.add_get('/status', status_check)
    
    return app

async def start_health_server():
    """Start the health check server"""
    app = await init_app()
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 8001))
    
    # Start the server
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    
    logger.info(f"🏥 Health check server started on port {port}")
    logger.info(f"🔍 Health endpoint: http://0.0.0.0:{port}/health")
    logger.info(f"📊 Status endpoint: http://0.0.0.0:{port}/status")
    
    return runner

async def main():
    """Main function to start health server"""
    try:
        runner = await start_health_server()
        
        # Keep the server running
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("🛑 Health server shutdown signal received")
    except Exception as e:
        logger.error(f"❌ Health server error: {e}")
        raise
    finally:
        # Cleanup
        if 'runner' in locals():
            await runner.cleanup()
            logger.info("✅ Health server stopped")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Health server interrupted")
    except Exception as e:
        logger.error(f"❌ Fatal health server error: {e}")
        sys.exit(1)
