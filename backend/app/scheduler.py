#!/usr/bin/env python3
"""
Scheduler Service Entry Point
This file runs only the scheduler without the web server.
Used by the separate backend-scheduler Railway service.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import the enhanced scheduler
from .services.enhanced_smart_scheduler import enhanced_smart_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Global variable to track scheduler status
scheduler_status = "stopped"

async def main():
    """Main scheduler function"""
    global scheduler_status
    
    try:
        logger.info("🚀 Starting Scheduler Service...")
        logger.info("📊 This service runs only the scheduler, no web server")
        
        # Start the enhanced scheduler
        enhanced_smart_scheduler.start()
        scheduler_status = "running"
        logger.info("✅ Enhanced Smart Scheduler started successfully")
        
        # Keep the service running
        logger.info("🔄 Scheduler service is now running...")
        logger.info("📡 Monitoring fixtures and processing predictions...")
        
        # Run indefinitely
        while True:
            await asyncio.sleep(60)  # Check every minute
            
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
    except Exception as e:
        logger.error(f"❌ Critical error in scheduler service: {e}")
        scheduler_status = "error"
        raise
    finally:
        # Stop the scheduler
        logger.info("🛑 Stopping scheduler...")
        enhanced_smart_scheduler.stop()
        scheduler_status = "stopped"
        logger.info("✅ Scheduler service stopped")

def get_health_status():
    """Get health status for Railway health checks"""
    current_time = datetime.now(timezone.utc)
    
    return {
        "status": "healthy" if scheduler_status == "running" else "unhealthy",
        "timestamp": current_time.isoformat(),
        "scheduler_status": scheduler_status,
        "service": "backend-scheduler",
        "uptime": "running" if scheduler_status == "running" else "stopped"
    }

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Scheduler service interrupted")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)
