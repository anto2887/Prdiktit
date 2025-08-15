# backend/app/services/enhanced_smart_scheduler.py
"""
Updated Enhanced Smart Scheduler that uses the Unified Transaction Manager
All database operations now go through unified session management
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
from .unified_transaction_manager import unified_transaction_manager
from .match_processor import MatchProcessor

# Configure loggers
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('match_processing_audit')
fixture_monitor_logger = logging.getLogger('fixture_monitoring')
transaction_logger = logging.getLogger('transaction_audit')

class FixtureMonitor:
    """Monitor fixtures for critical changes using unified transaction management"""
    
    def __init__(self):
        # No longer maintains its own database session
        self.last_check = None
    
    async def monitor_fixtures(self) -> Dict[str, Any]:
        """Monitor fixtures for changes using read-only session"""
        try:
            fixture_monitor_logger.info("MONITORING_CYCLE_START")
            
            # Use a read-only session for monitoring (no transactions needed)
            db = SessionLocal()
            try:
                # Get fixtures that need monitoring (matches in next 24 hours)
                now = datetime.now(timezone.utc)
                tomorrow = now + timedelta(hours=24)
                
                upcoming_matches = db.query(Fixture).filter(
                    Fixture.date.between(now, tomorrow),
                    Fixture.status == MatchStatus.NOT_STARTED
                ).all()
                
                # Get currently live matches
                live_matches = db.query(Fixture).filter(
                    Fixture.status.in_([
                        MatchStatus.FIRST_HALF,
                        MatchStatus.SECOND_HALF,
                        MatchStatus.HALFTIME,
                        MatchStatus.EXTRA_TIME,
                        MatchStatus.PENALTY,
                        MatchStatus.LIVE
                    ])
                ).all()
                
                result = {
                    "status": "success",
                    "upcoming_matches": len(upcoming_matches),
                    "live_matches": len(live_matches),
                    "changes_detected": 0,
                    "updates_applied": 0,
                    "critical_changes": [],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                fixture_monitor_logger.info(f"MONITORING_CYCLE_COMPLETE: {result}")
                return result
                
            finally:
                db.close()
                
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
    Enhanced intelligent scheduler using unified transaction management
    """
    
    def __init__(self):
        self.processor = MatchProcessor()  # Uses unified transaction manager
        self.fixture_monitor = FixtureMonitor()
        self.is_running = False
        self.thread = None
        
        # No longer maintains own database session
        
        # Scheduling configuration
        self.check_interval = 300  # Check every 5 minutes for schedule updates
        self.current_schedule = None
        self.last_schedule_check = None
        self.last_fixture_check = None
        self.last_api_update = None  # Track last API update to avoid rate limiting
        
        logger.info("🚀 EnhancedSmartScheduler initialized with unified transaction management")
        audit_logger.info("ENHANCED_SCHEDULER_INIT: Using unified transaction management")
    
    def start(self):
        """Start the enhanced scheduler"""
        if self.is_running:
            logger.warning("⚠️ Scheduler already running")
            return
        
        self.is_running = True
        self.thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.thread.start()
        
        logger.info("🚀 Enhanced Smart Scheduler started")
        audit_logger.info("SCHEDULER_STARTED")
    
    def stop(self):
        """Stop the enhanced scheduler"""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=30)
        
        logger.info("🛑 Enhanced Smart Scheduler stopped")
        audit_logger.info("SCHEDULER_STOPPED")
    
    def _run_scheduler(self):
        """Main scheduler loop"""
        logger.info("🔄 Scheduler loop started")
        
        while self.is_running:
            try:
                # Calculate current schedule
                schedule = self._calculate_dynamic_schedule()
                
                # Log schedule information
                logger.info(f"📅 Current schedule: {schedule['mode']} mode, "
                           f"frequency: {schedule['frequency']}s, "
                           f"reason: {schedule['reason']}")
                
                # Run processing cycle
                self._run_processing_cycle(schedule)
                
                # Wait for next cycle
                time.sleep(schedule['frequency'])
                
            except Exception as e:
                logger.error(f"❌ Error in scheduler loop: {e}")
                audit_logger.error(f"SCHEDULER_LOOP_ERROR: {str(e)}")
                time.sleep(300)  # Wait 5 minutes before retrying
    
    def _calculate_dynamic_schedule(self) -> Dict[str, Any]:
        """Calculate optimal scheduling frequency based on current match state"""
        try:
            # Use read-only session for schedule calculation
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc)
                
                # Check for live matches
                live_matches = db.query(Fixture).filter(
                    Fixture.status.in_([
                        MatchStatus.FIRST_HALF,
                        MatchStatus.SECOND_HALF,
                        MatchStatus.HALFTIME,
                        MatchStatus.EXTRA_TIME,
                        MatchStatus.PENALTY,
                        MatchStatus.LIVE
                    ])
                ).count()
                
                if live_matches > 0:
                    return {
                        "mode": "live_matches",
                        "frequency": 120,  # Every 2 minutes during live matches
                        "fixture_monitoring": True,
                        "reason": f"{live_matches} live matches in progress",
                        "live_matches": live_matches
                    }
                
                # Check for matches starting soon (next 2 hours)
                soon_threshold = now + timedelta(hours=2)
                upcoming_matches = db.query(Fixture).filter(
                    Fixture.date.between(now, soon_threshold),
                    Fixture.status == MatchStatus.NOT_STARTED
                ).count()
                
                if upcoming_matches > 0:
                    return {
                        "mode": "matches_starting_soon",
                        "frequency": 300,  # Every 5 minutes when matches starting soon
                        "fixture_monitoring": True,
                        "reason": f"{upcoming_matches} matches starting in next 2 hours",
                        "upcoming_matches": upcoming_matches
                    }
                
                # Check for matches today
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                today_end = today_start + timedelta(days=1)
                
                today_matches = db.query(Fixture).filter(
                    Fixture.date.between(today_start, today_end)
                ).count()
                
                if today_matches > 0:
                    return {
                        "mode": "match_day",
                        "frequency": 900,  # Every 15 minutes on match days
                        "fixture_monitoring": True,
                        "reason": f"{today_matches} matches scheduled for today"
                    }
                
                # Check for matches in next 3 days
                next_match = db.query(Fixture).filter(
                    Fixture.date > now
                ).order_by(Fixture.date.asc()).first()
                
                if next_match:
                    # Handle timezone-aware vs timezone-naive comparison
                    next_match_date = next_match.date
                    if next_match_date.tzinfo is None:
                        next_match_date = next_match_date.replace(tzinfo=timezone.utc)
                    
                    if next_match_date <= now + timedelta(days=3):
                        days_until_match = (next_match_date - now).days
                        return {
                            "mode": "upcoming_matches",
                            "frequency": 1800,  # Every 30 minutes when matches in next 3 days
                            "fixture_monitoring": False,
                            "reason": f"Next match in {days_until_match} days",
                            "next_match_date": next_match_date.isoformat()
                        }
                else:
                    return {
                        "mode": "minimal",
                        "frequency": 3600,  # Every hour when no matches
                        "fixture_monitoring": False,
                        "reason": "No matches in next 3 days",
                        "next_match_date": None
                    }
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error calculating schedule: {e}")
            return {
                "mode": "error_fallback",
                "frequency": 1800,  # Every 30 minutes as fallback
                "fixture_monitoring": False,
                "reason": f"Error in scheduling: {str(e)}"
            }
    
    def _run_processing_cycle(self, schedule: Dict[str, Any]):
        """Run a complete processing cycle using unified transaction management"""
        try:
            cycle_start = datetime.now(timezone.utc)
            logger.info(f"🔄 Starting processing cycle - {schedule['mode']} mode")
            audit_logger.info(f"PROCESSING_CYCLE_START: mode={schedule['mode']}, frequency={schedule['frequency']}")
            
            # Step 1: Update match statuses from API (if applicable)
            if schedule.get('fixture_monitoring', False):
                try:
                    # Check if we're in an async context
                    try:
                        asyncio.get_running_loop()
                        # We're in an async context, but this is a sync method
                        # Skip API updates for now in sync context
                        logger.info("⚠️ Skipping API updates in sync context")
                    except RuntimeError:
                        # No event loop running - this is expected in the scheduler thread
                        logger.info("📡 API updates skipped - no async context available")
                        
                except Exception as e:
                    logger.error(f"❌ Error checking for API updates: {e}")
            
            # Step 2: Run unified processing
            logger.info("⚙️ Running unified match and prediction processing...")
            processing_result = self.processor.process_all_matches()
            
            # Step 3: Log results
            cycle_duration = (datetime.now(timezone.utc) - cycle_start).total_seconds()
            
            if processing_result['status'] == 'success':
                logger.info(f"✅ Processing cycle completed in {cycle_duration:.2f}s: "
                           f"{processing_result['fixtures_updated']} fixtures updated, "
                           f"{processing_result['predictions_locked']} predictions locked, "
                           f"{processing_result['predictions_processed']} predictions processed")
                
                audit_logger.info(f"PROCESSING_CYCLE_SUCCESS: duration={cycle_duration:.2f}s, "
                                 f"mode={schedule['mode']}, result={processing_result}")
            else:
                logger.error(f"❌ Processing cycle failed in {cycle_duration:.2f}s: {processing_result['error_message']}")
                audit_logger.error(f"PROCESSING_CYCLE_FAILED: duration={cycle_duration:.2f}s, "
                                  f"mode={schedule['mode']}, result={processing_result}")
            
            # Step 4: Fixture monitoring and API updates (if enabled)
            if schedule.get('fixture_monitoring', False):
                try:
                    # Run fixture monitoring (this uses read-only session)
                    monitor_result = asyncio.run(self.fixture_monitor.monitor_fixtures())
                    logger.info(f"🔍 Fixture monitoring: {monitor_result['status']}")
                    
                    # Only trigger API updates every 15 minutes to avoid rate limiting
                    current_time = datetime.now(timezone.utc)
                    if not hasattr(self, 'last_api_update') or \
                       (current_time - self.last_api_update).total_seconds() > 900:  # 15 minutes
                        
                        logger.info("📡 Triggering API update check for fixture monitoring...")
                        api_result = self.trigger_api_update_check()
                        if api_result.get('status') == 'success':
                            logger.info(f"📡 API update check successful: {api_result.get('fixtures_updated', 0)} fixtures updated")
                        elif api_result.get('status') == 'skipped':
                            logger.info("📡 API update check skipped (already in event loop)")
                        else:
                            logger.warning(f"⚠️ API update check had issues: {api_result.get('message', 'Unknown error')}")
                        
                        self.last_api_update = current_time
                    else:
                        logger.info("⏳ Skipping API update (last update was less than 15 minutes ago)")
                        
                except Exception as e:
                    logger.error(f"❌ Error in fixture monitoring or API updates: {e}")
            
        except Exception as e:
            logger.error(f"❌ Critical error in processing cycle: {e}")
            audit_logger.error(f"PROCESSING_CYCLE_CRITICAL_ERROR: {str(e)}")
    
    async def run_enhanced_processing_with_status_updates(self):
        """
        Enhanced processing cycle that includes status updates
        This method ensures it's called in a proper async context
        """
        try:
            logger.info("🔄 Starting enhanced processing cycle with status updates")
            transaction_logger.info("ENHANCED_PROCESSING_START: With API status updates")
            
            # Step 1: Update match statuses from API (only if API is working)
            logger.info("📡 Step 1: Updating match statuses from API...")
            try:
                # Check if we have a proper async context
                asyncio.get_running_loop()
                
                # Update recent matches (last 3 days)
                updated_count = await match_status_updater.update_recent_matches(days_back=3)
                logger.info(f"✅ Updated {updated_count} match statuses from API")
                
                # Also update live matches
                live_updated = await match_status_updater.update_live_matches()
                if live_updated > 0:
                    logger.info(f"🔴 Updated {live_updated} live matches from API")
                    
            except Exception as e:
                logger.error(f"❌ Error updating match statuses from API: {e}")
            
            # Step 2: Run unified processing (async)
            logger.info("⚙️ Step 2: Running unified prediction and match processing (async)...")
            processing_result = await self.processor.process_all_matches_async()
            
            # Step 3: Log final results
            if processing_result['status'] == 'success':
                # Safely get verification_passed with fallback
                verification_status = processing_result.get('verification_passed', 'UNKNOWN')
                logger.info(f"✅ Enhanced processing complete: "
                           f"{processing_result.get('fixtures_updated', 0)} fixtures updated, "
                           f"{processing_result.get('predictions_locked', 0)} predictions locked, "
                           f"{processing_result.get('predictions_processed', 0)} predictions processed, "
                           f"Verification: {verification_status}")
                
                transaction_logger.info(f"ENHANCED_PROCESSING_SUCCESS: {processing_result}")
            else:
                logger.error(f"❌ Enhanced processing failed: {processing_result.get('error_message', 'Unknown error')}")
                transaction_logger.error(f"ENHANCED_PROCESSING_FAILED: {processing_result}")
            
            return processing_result
            
        except Exception as e:
            logger.error(f"❌ Critical error in enhanced processing: {e}")
            transaction_logger.error(f"ENHANCED_PROCESSING_CRITICAL_ERROR: {str(e)}")
            return {
                "status": "critical_error",
                "error_message": str(e),
                "message": f"Critical error in enhanced processing: {str(e)}"
            }
    
    def trigger_api_update_check(self):
        """
        Trigger an API update check from sync context
        This creates a new event loop to run async operations
        """
        try:
            logger.info("🔄 Triggering API update check from sync context...")
            
            # Check if we're already in an event loop
            try:
                asyncio.get_running_loop()
                logger.warning("⚠️ Already in event loop, skipping API update check")
                return {
                    "status": "skipped",
                    "message": "Already in event loop context"
                }
            except RuntimeError:
                # No event loop running, we can create one
                pass
            
            # Create a new event loop for this operation
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Run the async processing
                result = loop.run_until_complete(self.run_enhanced_processing_with_status_updates())
                logger.info(f"✅ API update check completed: {result.get('status', 'unknown')}")
                return result
            finally:
                loop.close()
                
        except Exception as e:
            logger.error(f"❌ Error in API update check: {e}")
            return {
                "status": "error",
                "error_message": str(e),
                "message": f"API update check failed: {str(e)}"
            }
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "current_schedule": self.current_schedule,
            "last_schedule_check": self.last_schedule_check.isoformat() if self.last_schedule_check else None,
            "last_fixture_check": self.last_fixture_check.isoformat() if self.last_fixture_check else None,
            "using_unified_transactions": True,
            "processor_type": "UnifiedTransactionManager"
        }

# Global instance
enhanced_smart_scheduler = EnhancedSmartScheduler()