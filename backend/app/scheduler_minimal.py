#!/usr/bin/env python3
"""
Scheduler Service - Uses existing backend services for fixture processing
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import time
from aiohttp import web

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

class SchedulerService:
    """Scheduler service that uses existing backend services"""
    
    def __init__(self):
        self.is_running = False
        self.last_check = None
        self.error_count = 0
        self.max_errors = 5
        self.error_reset_time = None
        
        # Import existing services after path setup
        self.scheduler = None
        self.match_updater = None
        self._import_services()
        
    def _import_services(self):
        """Import existing services safely"""
        try:
            # Import EnhancedSmartScheduler
            from app.services.enhanced_smart_scheduler import EnhancedSmartScheduler
            self.scheduler = EnhancedSmartScheduler()
            logger.info("✅ Successfully imported EnhancedSmartScheduler")
        except ImportError as e:
            logger.error(f"❌ Failed to import EnhancedSmartScheduler: {e}")
            self.scheduler = None
        
        try:
            # Import MatchStatusUpdater
            from app.services.match_status_updater import match_status_updater
            self.match_updater = match_status_updater
            logger.info("✅ Successfully imported MatchStatusUpdater")
        except ImportError as e:
            logger.error(f"❌ Failed to import MatchStatusUpdater: {e}")
            self.match_updater = None
        
        if not self.scheduler or not self.match_updater:
            logger.error("❌ Critical: Required services not available")
        
    def start(self):
        """Start the scheduler service"""
        global scheduler_status
        try:
            if not self.scheduler or not self.match_updater:
                logger.error("❌ Cannot start: Required services not available")
                return False
                
            self.is_running = True
            scheduler_status = "running"
            logger.info("🚀 Scheduler Service started successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Error starting scheduler service: {e}")
            scheduler_status = "error"
            return False
    
    def stop(self):
        """Stop the scheduler service"""
        global scheduler_status
        try:
            self.is_running = False
            scheduler_status = "stopped"
            logger.info("🛑 Scheduler Service stopped")
            return True
        except Exception as e:
            logger.error(f"❌ Error stopping scheduler service: {e}")
            return False
    
    async def run_scheduling_cycle(self):
        """Run a single scheduling cycle with actual fixture processing"""
        try:
            if not self.is_running or not self.scheduler or not self.match_updater:
                return False
                
            current_time = datetime.now(timezone.utc)
            
            # Run every 5 minutes for fixture monitoring
            if (self.last_check is None or 
                (current_time - self.last_check).total_seconds() > 300):
                
                logger.info("🔄 Running scheduling cycle with fixture processing...")
                
                # Run the actual scheduler processing
                await self._process_fixtures()
                
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
    
    async def _process_fixtures(self):
        """Process fixtures using existing backend services"""
        try:
            if not self.scheduler or not self.match_updater:
                logger.error("❌ Required services not available")
                return
            
            # Step 1: Update match statuses from Football API
            logger.info("📡 Fetching fresh match data from Football API...")
            
            try:
                # Update recent matches (last 3 days)
                recent_updates = await self.match_updater.update_recent_matches(days_back=3)
                logger.info(f"📊 Updated {recent_updates} recent matches from API")
            except Exception as e:
                logger.error(f"❌ Error updating recent matches: {e}")
            
            try:
                # Update live matches
                live_updates = await self.match_updater.update_live_matches()
                logger.info(f"🔴 Updated {live_updates} live matches from API")
            except Exception as e:
                logger.error(f"❌ Error updating live matches: {e}")
            
            # Step 2: Get the current schedule and run processing
            try:
                schedule = self.scheduler._calculate_schedule()
                logger.info(f"📅 Current schedule: {schedule['mode']} mode - {schedule['reason']}")
                
                # Run the processing cycle to handle predictions
                self.scheduler._run_processing_cycle(schedule)
                
                logger.info("✅ Fixture processing completed successfully")
            except Exception as e:
                logger.error(f"❌ Error in scheduler processing: {e}")
            
        except Exception as e:
            logger.error(f"❌ Error processing fixtures: {e}")
            raise

# Global scheduler instance
scheduler_service = SchedulerService()

async def main():
    """Main scheduler function with health check server"""
    global scheduler_status
    
    try:
        logger.info("🚀 Starting Scheduler Service...")
        logger.info("📊 This service uses existing backend services for fixture processing")
        
        # Start the scheduler service
        if not scheduler_service.start():
            logger.error("❌ Failed to start scheduler service")
            return
        
        # Start health check server
        health_app = web.Application()
        health_app.router.add_get('/health', lambda r: web.json_response(get_health_status()))
        health_app.router.add_get('/status', lambda r: web.json_response(get_health_status()))
        
        runner = web.AppRunner(health_app)
        await runner.setup()
        
        port = int(os.environ.get('PORT', 8001))
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        
        logger.info(f"🏥 Health check server started on port {port}")
        logger.info(f"🔍 Health endpoint: http://0.0.0.0:{port}/health")
        
        # Keep the service running with error handling
        logger.info("🔄 Scheduler service is now running...")
        logger.info("📡 Running scheduling cycles every 5 minutes...")
        
        # Main loop with error handling and circuit breaker
        while scheduler_service.is_running:
            try:
                success = await scheduler_service.run_scheduling_cycle()
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
        logger.error(f"❌ Critical error in scheduler service: {e}")
        scheduler_status = "error"
        raise
    finally:
        # Stop the scheduler
        logger.info("🛑 Stopping scheduler service...")
        scheduler_service.stop()
        logger.info("✅ Scheduler service stopped")

def get_health_status():
    """Get health status for Railway health checks"""
    current_time = datetime.now(timezone.utc)
    
    return {
        "status": "healthy" if scheduler_status == "running" else "unhealthy",
        "timestamp": current_time.isoformat(),
        "scheduler_status": scheduler_status,
        "service": "backend-scheduler",
        "uptime": "running" if scheduler_status == "running" else "stopped",
        "error_count": scheduler_service.error_count if hasattr(scheduler_service, 'error_count') else 0
    }

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Scheduler service interrupted")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)
