# backend/app/services/smart_scheduler.py
import logging
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from ..db.database import SessionLocal
from ..db.models import Fixture, MatchStatus
from .match_processor import MatchProcessor

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('match_processing_audit')

class SmartMatchScheduler:
    """
    Intelligent scheduler that only runs on match days and adapts frequency
    based on match activity and timing
    """
    
    def __init__(self):
        self.processor = None
        self.is_running = False
        self.thread = None
        self.db = SessionLocal()
        
        # Scheduling configuration
        self.check_interval = 300  # Check every 5 minutes for schedule updates
        self.current_schedule = None
        self.last_schedule_check = None
        
        try:
            self.processor = MatchProcessor()
            logger.info("✅ SmartMatchScheduler initialized with MatchProcessor")
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
            
            logger.debug(f"Found {len(matches)} matches scheduled for today")
            return matches
            
        except Exception as e:
            logger.error(f"Error getting today's matches: {e}")
            return []
    
    def get_upcoming_matches(self, days_ahead: int = 3) -> List[Fixture]:
        """Get matches in the next N days"""
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
        """
        Calculate the optimal processing schedule based on match timing
        """
        try:
            now = datetime.now(timezone.utc)
            todays_matches = self.get_todays_matches()
            upcoming_matches = self.get_upcoming_matches()
            
            # If no matches today or in next 3 days, minimal checking
            if not todays_matches and not upcoming_matches:
                return {
                    "mode": "minimal",
                    "frequency": 3600,  # Check every hour
                    "reason": "No matches in next 3 days",
                    "next_match_date": None
                }
            
            # Check if we have matches happening soon (within 2 hours)
            matches_soon = []
            matches_active = []
            matches_ending_soon = []
            
            for match in todays_matches:
                time_diff = (match.date - now).total_seconds() / 60  # minutes
                
                if match.status in [MatchStatus.LIVE, MatchStatus.FIRST_HALF, 
                                  MatchStatus.SECOND_HALF, MatchStatus.HALFTIME]:
                    matches_active.append(match)
                elif match.status in [MatchStatus.FINISHED, MatchStatus.FINISHED_AET, 
                                    MatchStatus.FINISHED_PEN]:
                    matches_ending_soon.append(match)
                elif -30 <= time_diff <= 120:  # 30 min before to 2 hours after kickoff
                    matches_soon.append(match)
            
            # Determine optimal frequency
            if matches_active or matches_ending_soon:
                # High frequency during active matches
                return {
                    "mode": "high_activity",
                    "frequency": 120,  # Every 2 minutes
                    "reason": f"{len(matches_active)} active, {len(matches_ending_soon)} recently finished",
                    "active_matches": len(matches_active),
                    "finished_matches": len(matches_ending_soon)
                }
            elif matches_soon:
                # Medium frequency around match times
                return {
                    "mode": "match_day_active",
                    "frequency": 300,  # Every 5 minutes
                    "reason": f"{len(matches_soon)} matches starting/ending soon",
                    "upcoming_matches": len(matches_soon)
                }
            elif todays_matches:
                # Lower frequency on match days but outside active periods
                next_match = min(todays_matches, key=lambda m: abs((m.date - now).total_seconds()))
                time_to_next = (next_match.date - now).total_seconds() / 60
                
                if time_to_next > 120:  # More than 2 hours away
                    return {
                        "mode": "match_day_waiting",
                        "frequency": 900,  # Every 15 minutes
                        "reason": f"Next match in {int(time_to_next)} minutes",
                        "next_match_time": next_match.date.isoformat()
                    }
                else:
                    return {
                        "mode": "match_day_approaching",
                        "frequency": 300,  # Every 5 minutes
                        "reason": f"Next match in {int(time_to_next)} minutes",
                        "next_match_time": next_match.date.isoformat()
                    }
            else:
                # Upcoming matches in next few days
                next_match = min(upcoming_matches, key=lambda m: m.date)
                time_to_next = (next_match.date - now).total_seconds() / 3600  # hours
                
                return {
                    "mode": "upcoming_matches",
                    "frequency": 1800,  # Every 30 minutes
                    "reason": f"Next match in {int(time_to_next)} hours",
                    "next_match_time": next_match.date.isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error calculating schedule: {e}")
            return {
                "mode": "error_fallback",
                "frequency": 1800,  # Every 30 minutes as fallback
                "reason": f"Error in scheduling: {str(e)}"
            }
    
    def should_update_schedule(self) -> bool:
        """Check if we should recalculate the schedule"""
        if not self.last_schedule_check:
            return True
        
        # Update schedule every 30 minutes or if significant time has passed
        time_since_check = datetime.now(timezone.utc) - self.last_schedule_check
        return time_since_check.total_seconds() > 1800  # 30 minutes
    
    def run_processing_cycle(self) -> Dict[str, Any]:
        """Run a single processing cycle with context logging"""
        if not self.processor:
            return {"status": "error", "error": "MatchProcessor not available"}
        
        try:
            cycle_start = datetime.now(timezone.utc)
            schedule_info = self.current_schedule or {"mode": "unknown"}
            
            logger.info(f"🔄 Starting processing cycle (mode: {schedule_info['mode']})")
            audit_logger.info(f"SMART_CYCLE_START: mode={schedule_info['mode']}, timestamp={cycle_start.isoformat()}")
            
            result = self.processor.run_all_processing()
            
            # Add scheduling context to result
            result["schedule_mode"] = schedule_info["mode"]
            result["cycle_start"] = cycle_start.isoformat()
            
            logger.info(f"✅ Processing cycle completed in mode: {schedule_info['mode']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error in processing cycle: {e}")
            return {"status": "error", "error": str(e)}
    
    def scheduler_loop(self):
        """Main scheduler loop with intelligent timing"""
        logger.info("🤖 Smart scheduler started")
        audit_logger.info("SMART_SCHEDULER_START")
        
        while self.is_running:
            try:
                # Update schedule if needed
                if self.should_update_schedule():
                    new_schedule = self.calculate_optimal_schedule()
                    
                    if new_schedule != self.current_schedule:
                        self.current_schedule = new_schedule
                        self.last_schedule_check = datetime.now(timezone.utc)
                        
                        logger.info(f"📅 Schedule updated: {new_schedule['mode']} - {new_schedule['reason']}")
                        logger.info(f"⏰ New frequency: every {new_schedule['frequency']} seconds")
                        audit_logger.info(f"SCHEDULE_UPDATE: {new_schedule}")
                
                # Run processing cycle
                if self.current_schedule:
                    result = self.run_processing_cycle()
                    
                    # Sleep for the calculated frequency
                    sleep_time = self.current_schedule["frequency"]
                    logger.debug(f"💤 Sleeping for {sleep_time} seconds until next cycle")
                    
                    # Sleep in small increments to allow for clean shutdown
                    slept = 0
                    while slept < sleep_time and self.is_running:
                        time.sleep(min(30, sleep_time - slept))  # Check every 30 seconds
                        slept += 30
                else:
                    # Fallback sleep if no schedule calculated
                    time.sleep(300)
                    
            except Exception as e:
                logger.error(f"❌ Error in scheduler loop: {e}")
                audit_logger.error(f"SCHEDULER_ERROR: {str(e)}")
                time.sleep(300)  # Wait 5 minutes before retrying
        
        logger.info("🛑 Smart scheduler stopped")
        audit_logger.info("SMART_SCHEDULER_STOP")
    
    def start_scheduler(self):
        """Start the intelligent scheduler"""
        if self.is_running:
            logger.warning("⚠️ Smart scheduler already running")
            return
        
        if not self.processor:
            logger.error("❌ Cannot start scheduler: MatchProcessor not available")
            return
        
        logger.info("🚀 Starting smart match-day scheduler...")
        
        # Calculate initial schedule
        self.current_schedule = self.calculate_optimal_schedule()
        self.last_schedule_check = datetime.now(timezone.utc)
        
        logger.info(f"📊 Initial schedule: {self.current_schedule['mode']} - {self.current_schedule['reason']}")
        logger.info(f"⏰ Initial frequency: every {self.current_schedule['frequency']} seconds")
        
        self.is_running = True
        self.thread = threading.Thread(target=self.scheduler_loop, daemon=True)
        self.thread.start()
        
        audit_logger.info(f"SMART_SCHEDULER_INIT: {self.current_schedule}")
        logger.info("✅ Smart scheduler started successfully")
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        if not self.is_running:
            return
        
        logger.info("🛑 Stopping smart scheduler...")
        self.is_running = False
        
        if self.thread:
            self.thread.join(timeout=10)
        
        audit_logger.info("SMART_SCHEDULER_SHUTDOWN")
        logger.info("✅ Smart scheduler stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "current_schedule": self.current_schedule,
            "last_schedule_check": self.last_schedule_check.isoformat() if self.last_schedule_check else None,
            "thread_alive": self.thread.is_alive() if self.thread else False,
            "processor_available": self.processor is not None,
            "todays_matches": len(self.get_todays_matches()),
            "upcoming_matches": len(self.get_upcoming_matches())
        }

# Global instance
smart_scheduler = SmartMatchScheduler()