# 3. Create: backend/app/services/background_tasks.py

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any
import schedule
import time
import threading

from .match_processor import MatchProcessor

logger = logging.getLogger(__name__)

class BackgroundTaskRunner:
    """Simple background task runner for match and prediction processing"""
    
    def __init__(self):
        self.processor = MatchProcessor()
        self.is_running = False
        self.thread = None
    
    def run_processing_cycle(self) -> Dict[str, Any]:
        """Run a single processing cycle"""
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
        schedule.clear()
        logger.info("Background task scheduler stopped")

# Global instance
background_runner = BackgroundTaskRunner()