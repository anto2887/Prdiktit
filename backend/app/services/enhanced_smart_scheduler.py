# backend/app/services/enhanced_smart_scheduler.py
"""
Enhanced Smart Scheduler with proper async/await handling

Fixed the event loop management and timeout context manager issues.
"""

import asyncio
import threading
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..db.models import Fixture, MatchStatus
from .match_status_updater import match_status_updater

# Configure loggers
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('match_processing_audit')
fixture_monitor_logger = logging.getLogger('fixture_monitoring')

class FixtureMonitor:
    """Monitor fixtures for critical changes"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.last_check = None
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    async def monitor_fixtures(self) -> Dict[str, Any]:
        """Monitor fixtures for changes and update database"""
        try:
            fixture_monitor_logger.info("MONITORING_CYCLE_START")
            
            # For now, return a simple success result
            # TODO: Implement actual fixture monitoring when API is stable
            
            result = {
                "status": "success",
                "changes_detected": 0,
                "updates_applied": 0,
                "critical_changes": [],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            fixture_monitor_logger.info(f"MONITORING_CYCLE_COMPLETE: {result}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error in fixture monitoring: {e}")
            fixture_monitor_logger.error(f"MONITORING_CYCLE_ERROR: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

class EnhancedSmartScheduler:
    """
    Enhanced intelligent scheduler with proper async handling
    """
    
    def __init__(self):
        self.processor = None
        self.fixture_monitor = FixtureMonitor()
        self.is_running = False
        self.thread = None
        self.db = SessionLocal()
        
        # Scheduling configuration
        self.check_interval = 300  # Check every 5 minutes for schedule updates
        self.current_schedule = None
        self.last_schedule_check = None
        self.last_fixture_check = None
        
        try:
            from .match_processor import MatchProcessor
            self.processor = MatchProcessor()
            logger.info("✅ Enhanced scheduler initialized with MatchProcessor and FixtureMonitor")
        except Exception as e:
            logger.error(f"❌ Failed to initialize MatchProcessor: {e}")
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def get_todays_matches(self) -> List[Fixture]:
        """Get all matches happening today (UTC)"""
        try:
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = today_start + timedelta(days=1)
            
            matches = self.db.query(Fixture).filter(
                Fixture.date >= today_start,
                Fixture.date < today_end
            ).all()
            
            return matches
            
        except Exception as e:
            logger.error(f"Error getting today's matches: {e}")
            return []
    
    def get_upcoming_matches(self, days_ahead: int = 7) -> List[Fixture]:
        """Get upcoming matches in the next N days"""
        try:
            now = datetime.now(timezone.utc)
            future_date = now + timedelta(days=days_ahead)
            
            matches = self.db.query(Fixture).filter(
                Fixture.date >= now,
                Fixture.date <= future_date,
                Fixture.status == MatchStatus.NOT_STARTED
            ).order_by(Fixture.date).all()
            
            return matches
            
        except Exception as e:
            logger.error(f"Error getting upcoming matches: {e}")
            return []
    
    def calculate_optimal_schedule(self) -> Dict[str, Any]:
        """Calculate optimal scheduling frequency based on upcoming matches"""
        try:
            now = datetime.now(timezone.utc)
            today_matches = self.get_todays_matches()
            upcoming_matches = self.get_upcoming_matches(days_ahead=3)
            
            # Enable fixture monitoring for match days
            fixture_monitoring_enabled = len(today_matches) > 0
            
            if today_matches:
                # Match day - high frequency monitoring
                live_matches = [m for m in today_matches if m.status in [
                    MatchStatus.FIRST_HALF, MatchStatus.HALFTIME, 
                    MatchStatus.SECOND_HALF, MatchStatus.LIVE
                ]]
                
                if live_matches:
                    return {
                        "mode": "live_matches",
                        "frequency": 60,  # Every minute during live matches
                        "fixture_monitoring": True,
                        "reason": f"{len(live_matches)} live matches",
                        "live_match_count": len(live_matches)
                    }
                else:
                    return {
                        "mode": "match_day",
                        "frequency": 300,  # Every 5 minutes on match days
                        "fixture_monitoring": fixture_monitoring_enabled,
                        "reason": f"{len(today_matches)} matches today",
                        "todays_match_count": len(today_matches)
                    }
            
            elif upcoming_matches:
                # Check time to next match
                next_match = min(upcoming_matches, key=lambda m: m.date)
                time_to_next = (next_match.date - now).total_seconds() / 60  # minutes
                
                if time_to_next <= 60:  # Within 1 hour
                    return {
                        "mode": "match_starting_soon", 
                        "frequency": 120,  # Every 2 minutes
                        "fixture_monitoring": fixture_monitoring_enabled,
                        "reason": f"Next match in {int(time_to_next)} minutes",
                        "next_match_time": next_match.date.isoformat()
                    }
                elif time_to_next <= 360:  # Within 6 hours
                    return {
                        "mode": "match_day_approaching",
                        "frequency": 300,  # Every 5 minutes
                        "fixture_monitoring": fixture_monitoring_enabled,
                        "reason": f"Next match in {int(time_to_next)} minutes",
                        "next_match_time": next_match.date.isoformat()
                    }
                else:
                    next_match = min(upcoming_matches, key=lambda m: m.date)
                    time_to_next = (next_match.date - now).total_seconds() / 3600  # hours
                    
                    return {
                        "mode": "upcoming_matches",
                        "frequency": 1800,  # Every 30 minutes
                        "fixture_monitoring": fixture_monitoring_enabled,
                        "reason": f"Next match in {int(time_to_next)} hours",
                        "next_match_time": next_match.date.isoformat()
                    }
            else:
                return {
                    "mode": "minimal",
                    "frequency": 3600,  # Every hour when no matches
                    "fixture_monitoring": False,
                    "reason": "No matches in next 3 days",
                    "next_match_date": None
                }
                
        except Exception as e:
            logger.error(f"Error calculating schedule: {e}")
            return {
                "mode": "error_fallback",
                "frequency": 1800,  # Every 30 minutes as fallback
                "fixture_monitoring": False,
                "reason": f"Error in scheduling: {str(e)}"
            }
    
    async def run_enhanced_processing_with_status_updates(self):
        """
        Enhanced processing cycle that includes status updates
        
        This method ensures it's called in a proper async context
        """
        try:
            logger.info("🔄 Starting enhanced processing cycle with status updates")
            
            # Step 1: Update match statuses from API (only if API is working)
            logger.info("📡 Step 1: Updating match statuses from API...")
            try:
                # Check if we have a proper async context
                try:
                    asyncio.get_running_loop()
                    
                    # Update recent matches (last 3 days)
                    updated_count = await match_status_updater.update_recent_matches(days_back=3)
                    logger.info(f"✅ Updated {updated_count} match statuses")
                    
                    # Also update live matches
                    live_updated = await match_status_updater.update_live_matches()
                    if live_updated > 0:
                        logger.info(f"🔴 Updated {live_updated} live matches")
                        
                except RuntimeError:
                    # No event loop running - skip API updates
                    logger.warning("⚠️ No event loop running - skipping API status updates")
                    
            except Exception as e:
                logger.error(f"❌ Error updating match statuses: {e}")
            
            # Step 2: Run normal processing (prediction locking and match processing)
            logger.info("⚙️ Step 2: Running prediction and match processing...")
            
            # Import here to avoid circular imports
            from .match_processor import MatchProcessor
            
            processor = MatchProcessor()
            
            # Run the full processing cycle (this is synchronous)
            result = processor.run_all_processing()
            
            logger.info("✅ Enhanced processing cycle with status updates completed")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error in enhanced processing cycle: {e}")
            return {"status": "error", "error": str(e)}

    def should_update_schedule(self) -> bool:
        """Check if we should recalculate the schedule"""
        if not self.last_schedule_check:
            return True
        
        time_since_check = datetime.now(timezone.utc) - self.last_schedule_check
        return time_since_check.total_seconds() > 1800  # 30 minutes
    
    def scheduler_loop(self):
        """Main scheduler loop with proper async handling"""
        logger.info("🤖 Enhanced smart scheduler started")
        audit_logger.info("ENHANCED_SCHEDULER_START")
        
        while self.is_running:
            try:
                # Update schedule if needed
                if self.should_update_schedule():
                    new_schedule = self.calculate_optimal_schedule()
                    
                    if new_schedule != self.current_schedule:
                        self.current_schedule = new_schedule
                        self.last_schedule_check = datetime.now(timezone.utc)
                        
                        monitoring_status = "enabled" if new_schedule.get('fixture_monitoring') else "disabled"
                        logger.info(f"📅 Schedule updated: {new_schedule['mode']} - {new_schedule['reason']}")
                        logger.info(f"⏰ Frequency: every {new_schedule['frequency']} seconds")
                        logger.info(f"📡 Fixture monitoring: {monitoring_status}")
                        
                        audit_logger.info(f"ENHANCED_SCHEDULE_UPDATE: {new_schedule}")
                
                # Run processing cycle
                if self.current_schedule:
                    try:
                        # Create a new event loop for this thread if needed
                        try:
                            loop = asyncio.get_event_loop()
                        except RuntimeError:
                            # No event loop in this thread, create one
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                        
                        # Run the async processing method properly
                        if loop.is_running():
                            # Loop is already running (shouldn't happen in daemon thread)
                            logger.warning("⚠️ Event loop already running, skipping async operations")
                            # Just run sync processing
                            from .match_processor import MatchProcessor
                            processor = MatchProcessor()
                            result = processor.run_all_processing()
                        else:
                            # Run async processing
                            result = loop.run_until_complete(
                                self.run_enhanced_processing_with_status_updates()
                            )
                        
                    except Exception as e:
                        logger.error(f"❌ Error in processing cycle: {e}")
                        # Fallback to sync processing only
                        try:
                            from .match_processor import MatchProcessor
                            processor = MatchProcessor()
                            result = processor.run_all_processing()
                        except Exception as fallback_error:
                            logger.error(f"❌ Fallback processing also failed: {fallback_error}")
                    
                    # Sleep for the calculated frequency
                    sleep_time = self.current_schedule["frequency"]
                    
                    # Sleep in small increments to allow for clean shutdown
                    slept = 0
                    while slept < sleep_time and self.is_running:
                        time.sleep(min(30, sleep_time - slept))
                        slept += 30
                else:
                    time.sleep(300)
                    
            except Exception as e:
                logger.error(f"❌ Error in enhanced scheduler loop: {e}")
                audit_logger.error(f"ENHANCED_SCHEDULER_ERROR: {str(e)}")
                time.sleep(300)
        
        logger.info("🛑 Enhanced smart scheduler stopped")
        audit_logger.info("ENHANCED_SCHEDULER_STOP")
    
    def start_scheduler(self):
        """Start the enhanced scheduler"""
        if self.is_running:
            logger.warning("⚠️ Enhanced scheduler already running")
            return
        
        if not self.processor:
            logger.error("❌ Cannot start scheduler: MatchProcessor not available")
            return
        
        logger.info("🚀 Starting enhanced smart scheduler with fixture monitoring...")
        
        # Calculate initial schedule
        self.current_schedule = self.calculate_optimal_schedule()
        self.last_schedule_check = datetime.now(timezone.utc)
        
        monitoring_status = "enabled" if self.current_schedule.get('fixture_monitoring') else "disabled"
        logger.info(f"📊 Initial schedule: {self.current_schedule['mode']} - {self.current_schedule['reason']}")
        logger.info(f"⏰ Initial frequency: every {self.current_schedule['frequency']} seconds")
        logger.info(f"📡 Fixture monitoring: {monitoring_status}")
        
        self.is_running = True
        self.thread = threading.Thread(target=self.scheduler_loop, daemon=True)
        self.thread.start()
        
        audit_logger.info(f"ENHANCED_SCHEDULER_INIT: {self.current_schedule}")
        logger.info("✅ Enhanced smart scheduler started successfully")
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        if not self.is_running:
            return
        
        logger.info("🛑 Stopping enhanced scheduler...")
        self.is_running = False
        
        if self.thread:
            self.thread.join(timeout=10)
        
        audit_logger.info("ENHANCED_SCHEDULER_SHUTDOWN")
        logger.info("✅ Enhanced scheduler stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "current_schedule": self.current_schedule,
            "last_schedule_check": self.last_schedule_check.isoformat() if self.last_schedule_check else None,
            "thread_alive": self.thread.is_alive() if self.thread else False,
            "processor_available": self.processor is not None,
            "fixture_monitor_available": self.fixture_monitor is not None,
            "todays_matches": len(self.get_todays_matches()),
            "upcoming_matches": len(self.get_upcoming_matches()),
            "fixture_monitoring_enabled": self.current_schedule.get('fixture_monitoring', False) if self.current_schedule else False
        }

# Global instance
enhanced_smart_scheduler = EnhancedSmartScheduler()