#!/usr/bin/env python3
"""
Minimal Scheduler Service
Avoids circular imports by using minimal dependencies
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import time

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Global variable to track scheduler status
scheduler_status = "stopped"

class MinimalScheduler:
    """Minimal scheduler that avoids circular imports"""
    
    def __init__(self):
        self.is_running = False
        self.last_check = None
        self.error_count = 0
        self.max_errors = 5
        self.error_reset_time = None
        
    def start(self):
        """Start the minimal scheduler"""
        global scheduler_status
        try:
            self.is_running = True
            scheduler_status = "running"
            logger.info("🚀 Minimal Scheduler started successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Error starting minimal scheduler: {e}")
            scheduler_status = "error"
            return False
    
    def stop(self):
        """Stop the minimal scheduler"""
        global scheduler_status
        try:
            self.is_running = False
            scheduler_status = "stopped"
            logger.info("🛑 Minimal Scheduler stopped")
            return True
        except Exception as e:
            logger.error(f"❌ Error stopping minimal scheduler: {e}")
            return False
    
    async def run_scheduling_cycle(self):
        """Run a single scheduling cycle with error handling"""
        try:
            if not self.is_running:
                return False
                
            current_time = datetime.now(timezone.utc)
            
            # Simple scheduling logic - check every 5 minutes
            if (self.last_check is None or 
                (current_time - self.last_check).total_seconds() > 300):
                
                logger.info("🔄 Running scheduling cycle...")
                
                # Here you would implement the actual scheduling logic
                # For now, just log that we're running
                await self._process_schedule()
                
                self.last_check = current_time
                self.error_count = 0  # Reset error count on success
                
            return True
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"❌ Error in scheduling cycle {self.error_count}: {e}")
            
            # Implement circuit breaker pattern
            if self.error_count >= self.max_errors:
                logger.error(f"🚨 Circuit breaker activated after {self.error_count} errors")
                self.is_running = False
                scheduler_status = "circuit_breaker"
                return False
                
            return False
    
    async def _process_schedule(self):
        """Process the current schedule"""
        try:
            # This is where you would implement the actual scheduling logic
            # For now, just simulate some work
            await asyncio.sleep(1)
            logger.info("✅ Schedule processed successfully")
            
        except Exception as e:
            logger.error(f"❌ Error processing schedule: {e}")
            raise

# Global scheduler instance
minimal_scheduler = MinimalScheduler()

async def main():
    """Main scheduler function"""
    global scheduler_status
    
    try:
        logger.info("🚀 Starting Minimal Scheduler Service...")
        logger.info("📊 This service runs a minimal scheduler to avoid circular imports")
        
        # Start the minimal scheduler
        if not minimal_scheduler.start():
            logger.error("❌ Failed to start minimal scheduler")
            return
        
        # Keep the service running with error handling
        logger.info("🔄 Minimal scheduler service is now running...")
        logger.info("📡 Running scheduling cycles every 5 minutes...")
        
        # Main loop with error handling and circuit breaker
        while minimal_scheduler.is_running:
            try:
                success = await minimal_scheduler.run_scheduling_cycle()
                if not success:
                    logger.warning("⚠️ Scheduling cycle failed, waiting before retry...")
                    await asyncio.sleep(60)  # Wait 1 minute before retry
                else:
                    await asyncio.sleep(60)  # Check every minute
                    
            except Exception as e:
                logger.error(f"❌ Critical error in main loop: {e}")
                await asyncio.sleep(60)  # Wait before retry
                
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
    except Exception as e:
        logger.error(f"❌ Critical error in minimal scheduler service: {e}")
        scheduler_status = "error"
        raise
    finally:
        # Stop the scheduler
        logger.info("🛑 Stopping minimal scheduler...")
        minimal_scheduler.stop()
        logger.info("✅ Minimal scheduler service stopped")

def get_health_status():
    """Get health status for Railway health checks"""
    current_time = datetime.now(timezone.utc)
    
    return {
        "status": "healthy" if scheduler_status == "running" else "unhealthy",
        "timestamp": current_time.isoformat(),
        "scheduler_status": scheduler_status,
        "service": "backend-scheduler-minimal",
        "uptime": "running" if scheduler_status == "running" else "stopped",
        "error_count": minimal_scheduler.error_count if hasattr(minimal_scheduler, 'error_count') else 0
    }

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Minimal scheduler service interrupted")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)
