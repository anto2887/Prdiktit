# backend/app/services/background_tasks.py
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any
import threading

# Add error handling for missing dependencies
try:
    import schedule
    import time
    SCHEDULE_AVAILABLE = True
except ImportError as e:
    logging.error(f"Schedule library not available: {e}")
    SCHEDULE_AVAILABLE = False

try:
    from .match_processor import MatchProcessor
    MATCH_PROCESSOR_AVAILABLE = True
except ImportError as e:
    logging.error(f"MatchProcessor not available: {e}")
    MATCH_PROCESSOR_AVAILABLE = False

logger = logging.getLogger(__name__)

class BackgroundTaskRunner:
    """Simple background task runner for match and prediction processing"""
    
    def __init__(self):
        self.processor = None
        if MATCH_PROCESSOR_AVAILABLE:
            try:
                self.processor = MatchProcessor()
            except Exception as e:
                logger.error(f"Failed to initialize MatchProcessor: {e}")
        
        self.is_running = False
        self.thread = None
    
    def run_processing_cycle(self) -> Dict[str, Any]:
        """Run a single processing cycle"""
        if not self.processor:
            return {"status": "error", "error": "MatchProcessor not available"}
        
        try:
            logger.info("Starting background processing cycle")
            result = self.processor.run_all_processing()
            logger.info(f"Background processing cycle completed: {result}")
            return result
        except Exception as e:
            logger.error(f"Error in background processing cycle: {e}")
            return {"status": "error", "error": str(e)}
    
    def start_scheduler(self):
        """Start the background task scheduler"""
        if not SCHEDULE_AVAILABLE:
            logger.error("Cannot start scheduler: schedule library not available")
            return
        
        if not self.processor:
            logger.error("Cannot start scheduler: MatchProcessor not available")
            return
        
        if self.is_running:
            logger.warning("Background tasks already running")
            return
        
        # Schedule tasks
        schedule.every(5).minutes.do(self.run_processing_cycle)
        
        self.is_running = True
        
        def run_schedule():
            logger.info("Background task scheduler started")
            while self.is_running:
                schedule.run_pending()
                time.sleep(30)  # Check every 30 seconds
            logger.info("Background task scheduler stopped")
        
        self.thread = threading.Thread(target=run_schedule, daemon=True)
        self.thread.start()
        
        logger.info("Background task runner initialized - processing every 5 minutes")
    
    def stop_scheduler(self):
        """Stop the background task scheduler"""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=5)
        if SCHEDULE_AVAILABLE:
            schedule.clear()
        logger.info("Background task scheduler stopped")

# Global instance
background_runner = BackgroundTaskRunner()