# backend/app/services/enhanced_smart_scheduler.py
import logging
import threading
import time
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..db.database import SessionLocal
from ..db.models import Fixture, MatchStatus
from .match_processor import MatchProcessor

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('match_processing_audit')
fixture_monitor_logger = logging.getLogger('fixture_monitoring')

# Set up fixture monitoring logger
if not fixture_monitor_logger.handlers:
    import os
    log_dir = os.path.join(os.path.dirname(__file__), '../../logs')
    os.makedirs(log_dir, exist_ok=True)
    
    fixture_handler = logging.FileHandler(os.path.join(log_dir, 'fixture_monitoring.log'))
    fixture_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    fixture_handler.setFormatter(fixture_formatter)
    fixture_monitor_logger.addHandler(fixture_handler)
    fixture_monitor_logger.setLevel(logging.INFO)

class FixtureMonitor:
    """Handles proactive fixture monitoring and updates"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.last_api_call = None
        self.api_call_interval = 1800  # 30 minutes between API calls (rate limiting)
        
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    async def should_check_fixtures(self) -> bool:
        """Determine if we should make an API call to check fixtures"""
        if not self.last_api_call:
            return True
        
        time_since_last = datetime.now(timezone.utc) - self.last_api_call
        return time_since_last.total_seconds() > self.api_call_interval
    
    async def get_fixtures_needing_monitoring(self) -> List[Fixture]:
        """Get fixtures that should be monitored for changes"""
        try:
            now = datetime.now(timezone.utc)
            
            # Monitor fixtures that are:
            # 1. Scheduled for today or tomorrow
            # 2. Not yet finished
            # 3. Could potentially change
            tomorrow = now + timedelta(days=1)
            yesterday = now - timedelta(days=1)
            
            fixtures = self.db.query(Fixture).filter(
                Fixture.date >= yesterday,
                Fixture.date <= tomorrow,
                ~Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN,
                    MatchStatus.CANCELLED,
                    MatchStatus.ABANDONED
                ])
            ).all()
            
            logger.debug(f"Found {len(fixtures)} fixtures needing monitoring")
            return fixtures
            
        except Exception as e:
            logger.error(f"Error getting fixtures for monitoring: {e}")
            return []
    
    async def fetch_fixture_updates_from_api(self, fixture_ids: List[int]) -> Dict[int, Dict]:
        """
        Fetch fixture updates from external API
        This would integrate with your football API service
        """
        try:
            # Import your football API service
            from ..services.football_api import football_api_service
            
            logger.info(f"🔄 Fetching updates for {len(fixture_ids)} fixtures from API")
            fixture_monitor_logger.info(f"API_CALL_START: checking {len(fixture_ids)} fixtures")
            
            updates = {}
            
            # Batch API calls to avoid rate limiting
            for fixture_id in fixture_ids:
                try:
                    # This would be your actual API call
                    api_data = await football_api_service.get_fixture_by_id(fixture_id)
                    
                    if api_data:
                        updates[fixture_id] = {
                            'date': api_data.get('date'),
                            'status': api_data.get('status'),
                            'home_score': api_data.get('home_score'),
                            'away_score': api_data.get('away_score'),
                            'venue': api_data.get('venue'),
                            'referee': api_data.get('referee')
                        }
                    
                    # Small delay to respect rate limits
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.warning(f"Failed to fetch updates for fixture {fixture_id}: {e}")
                    continue
            
            self.last_api_call = datetime.now(timezone.utc)
            
            logger.info(f"✅ Successfully fetched updates for {len(updates)} fixtures")
            fixture_monitor_logger.info(f"API_CALL_SUCCESS: retrieved {len(updates)} fixture updates")
            
            return updates
            
        except Exception as e:
            logger.error(f"❌ Error fetching fixture updates from API: {e}")
            fixture_monitor_logger.error(f"API_CALL_ERROR: {str(e)}")
            return {}
    
    async def detect_fixture_changes(self, fixture: Fixture, api_data: Dict) -> Dict[str, Any]:
        """Detect what has changed in a fixture"""
        changes = {}
        
        # Check date changes (postponements/rescheduling)
        if api_data.get('date'):
            api_date = datetime.fromisoformat(api_data['date'].replace('Z', '+00:00'))
            if fixture.date != api_date:
                changes['date'] = {
                    'old': fixture.date.isoformat() if fixture.date else None,
                    'new': api_date.isoformat(),
                    'change_type': 'postponement' if api_date > fixture.date else 'brought_forward'
                }
        
        # Check status changes
        if api_data.get('status'):
            api_status_str = api_data['status']
            try:
                api_status = MatchStatus(api_status_str)
                if fixture.status != api_status:
                    changes['status'] = {
                        'old': fixture.status.value,
                        'new': api_status.value,
                        'change_type': 'status_update'
                    }
            except ValueError:
                logger.warning(f"Unknown status from API: {api_status_str}")
        
        # Check score changes (for live matches)
        if api_data.get('home_score') is not None and api_data.get('away_score') is not None:
            if (fixture.home_score != api_data['home_score'] or 
                fixture.away_score != api_data['away_score']):
                changes['score'] = {
                    'old': f"{fixture.home_score or 0}-{fixture.away_score or 0}",
                    'new': f"{api_data['home_score']}-{api_data['away_score']}",
                    'change_type': 'score_update'
                }
        
        # Check venue changes
        if api_data.get('venue') and fixture.venue != api_data['venue']:
            changes['venue'] = {
                'old': fixture.venue,
                'new': api_data['venue'],
                'change_type': 'venue_change'
            }
        
        return changes
    
    async def apply_fixture_updates(self, fixture: Fixture, api_data: Dict, changes: Dict) -> bool:
        """Apply the detected changes to the database"""
        try:
            updated = False
            
            # Apply date changes
            if 'date' in changes:
                old_date = fixture.date
                new_date = datetime.fromisoformat(api_data['date'].replace('Z', '+00:00'))
                fixture.date = new_date
                updated = True
                
                logger.warning(f"📅 FIXTURE RESCHEDULED: {fixture.home_team} vs {fixture.away_team}")
                logger.warning(f"   Old date: {old_date}")
                logger.warning(f"   New date: {new_date}")
                
                fixture_monitor_logger.warning(f"FIXTURE_RESCHEDULED: fixture_id={fixture.fixture_id}, match='{fixture.home_team} vs {fixture.away_team}', old_date='{old_date}', new_date='{new_date}'")
            
            # Apply status changes
            if 'status' in changes:
                old_status = fixture.status
                new_status = MatchStatus(api_data['status'])
                fixture.status = new_status
                updated = True
                
                logger.info(f"📊 STATUS UPDATED: {fixture.home_team} vs {fixture.away_team} - {old_status.value} → {new_status.value}")
                fixture_monitor_logger.info(f"STATUS_UPDATE: fixture_id={fixture.fixture_id}, old_status='{old_status.value}', new_status='{new_status.value}'")
            
            # Apply score changes
            if 'score' in changes:
                fixture.home_score = api_data['home_score']
                fixture.away_score = api_data['away_score']
                updated = True
                
                logger.info(f"⚽ SCORE UPDATED: {fixture.home_team} vs {fixture.away_team} - {api_data['home_score']}-{api_data['away_score']}")
                fixture_monitor_logger.info(f"SCORE_UPDATE: fixture_id={fixture.fixture_id}, score='{api_data['home_score']}-{api_data['away_score']}'")
            
            # Apply venue changes
            if 'venue' in changes:
                fixture.venue = api_data['venue']
                updated = True
                
                logger.info(f"🏟️ VENUE CHANGED: {fixture.home_team} vs {fixture.away_team} - {changes['venue']['old']} → {changes['venue']['new']}")
                fixture_monitor_logger.info(f"VENUE_CHANGE: fixture_id={fixture.fixture_id}, old_venue='{changes['venue']['old']}', new_venue='{changes['venue']['new']}'")
            
            if updated:
                fixture.updated_at = datetime.now(timezone.utc)
                self.db.commit()
                
            return updated
            
        except Exception as e:
            logger.error(f"❌ Error applying fixture updates: {e}")
            self.db.rollback()
            return False
    
    async def check_and_update_fixtures(self) -> Dict[str, Any]:
        """Main method to check for and apply fixture updates"""
        start_time = datetime.now(timezone.utc)
        
        try:
            # Check if we should make API calls
            if not await self.should_check_fixtures():
                time_until_next = self.api_call_interval - (start_time - self.last_api_call).total_seconds()
                return {
                    "status": "skipped",
                    "reason": f"Rate limited - next check in {int(time_until_next)} seconds",
                    "last_api_call": self.last_api_call.isoformat() if self.last_api_call else None
                }
            
            logger.info("🔍 Starting fixture monitoring cycle")
            fixture_monitor_logger.info(f"MONITORING_CYCLE_START: timestamp={start_time.isoformat()}")
            
            # Get fixtures to monitor
            fixtures_to_monitor = await self.get_fixtures_needing_monitoring()
            
            if not fixtures_to_monitor:
                logger.info("📅 No fixtures need monitoring at this time")
                return {
                    "status": "success",
                    "fixtures_checked": 0,
                    "changes_detected": 0,
                    "updates_applied": 0
                }
            
            # Fetch updates from API
            fixture_ids = [f.fixture_id for f in fixtures_to_monitor]
            api_updates = await self.fetch_fixture_updates_from_api(fixture_ids)
            
            changes_detected = 0
            updates_applied = 0
            critical_changes = []
            
            # Process each fixture
            for fixture in fixtures_to_monitor:
                if fixture.fixture_id in api_updates:
                    api_data = api_updates[fixture.fixture_id]
                    
                    # Detect changes
                    changes = await self.detect_fixture_changes(fixture, api_data)
                    
                    if changes:
                        changes_detected += 1
                        
                        # Check for critical changes (postponements, cancellations)
                        if 'date' in changes or ('status' in changes and 
                           changes['status']['new'] in ['POSTPONED', 'CANCELLED']):
                            critical_changes.append({
                                'fixture_id': fixture.fixture_id,
                                'match': f"{fixture.home_team} vs {fixture.away_team}",
                                'changes': changes
                            })
                        
                        # Apply updates
                        if await self.apply_fixture_updates(fixture, api_data, changes):
                            updates_applied += 1
            
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            result = {
                "status": "success",
                "fixtures_checked": len(fixtures_to_monitor),
                "changes_detected": changes_detected,
                "updates_applied": updates_applied,
                "critical_changes": critical_changes,
                "duration_seconds": duration,
                "timestamp": end_time.isoformat()
            }
            
            if critical_changes:
                logger.warning(f"🚨 {len(critical_changes)} CRITICAL fixture changes detected!")
                for change in critical_changes:
                    logger.warning(f"   {change['match']}: {list(change['changes'].keys())}")
            
            logger.info(f"✅ Fixture monitoring complete: {changes_detected} changes detected, {updates_applied} applied")
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
    Enhanced intelligent scheduler with fixture monitoring capabilities
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
    
    def should_monitor_fixtures(self) -> bool:
        """Determine if we should run fixture monitoring"""
        # Only monitor on match days or when we have upcoming matches
        todays_matches = self.get_todays_matches()
        upcoming_matches = self.get_upcoming_matches(days_ahead=1)
        
        return len(todays_matches) > 0 or len(upcoming_matches) > 0
    
    def calculate_optimal_schedule(self) -> Dict[str, Any]:
        """Calculate optimal processing schedule (same as before but with fixture monitoring)"""
        try:
            now = datetime.now(timezone.utc)
            todays_matches = self.get_todays_matches()
            upcoming_matches = self.get_upcoming_matches()
            
            # Determine if fixture monitoring should be enabled
            fixture_monitoring_enabled = self.should_monitor_fixtures()
            
            # If no matches today or in next 3 days, minimal checking
            if not todays_matches and not upcoming_matches:
                return {
                    "mode": "minimal",
                    "frequency": 3600,  # Check every hour
                    "fixture_monitoring": False,
                    "reason": "No matches in next 3 days",
                    "next_match_date": None
                }
            
            # Check match timing for processing frequency
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
                return {
                    "mode": "high_activity",
                    "frequency": 120,  # Every 2 minutes
                    "fixture_monitoring": fixture_monitoring_enabled,
                    "reason": f"{len(matches_active)} active, {len(matches_ending_soon)} recently finished",
                    "active_matches": len(matches_active),
                    "finished_matches": len(matches_ending_soon)
                }
            elif matches_soon:
                return {
                    "mode": "match_day_active",
                    "frequency": 300,  # Every 5 minutes
                    "fixture_monitoring": fixture_monitoring_enabled,
                    "reason": f"{len(matches_soon)} matches starting/ending soon",
                    "upcoming_matches": len(matches_soon)
                }
            elif todays_matches:
                next_match = min(todays_matches, key=lambda m: abs((m.date - now).total_seconds()))
                time_to_next = (next_match.date - now).total_seconds() / 60
                
                if time_to_next > 120:  # More than 2 hours away
                    return {
                        "mode": "match_day_waiting",
                        "frequency": 900,  # Every 15 minutes
                        "fixture_monitoring": fixture_monitoring_enabled,
                        "reason": f"Next match in {int(time_to_next)} minutes",
                        "next_match_time": next_match.date.isoformat()
                    }
                else:
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
                
        except Exception as e:
            logger.error(f"Error calculating schedule: {e}")
            return {
                "mode": "error_fallback",
                "frequency": 1800,  # Every 30 minutes as fallback
                "fixture_monitoring": False,
                "reason": f"Error in scheduling: {str(e)}"
            }
    
    async def run_processing_cycle(self) -> Dict[str, Any]:
        """Run processing cycle with optional fixture monitoring"""
        if not self.processor:
            return {"status": "error", "error": "MatchProcessor not available"}
        
        try:
            cycle_start = datetime.now(timezone.utc)
            schedule_info = self.current_schedule or {"mode": "unknown"}
            
            logger.info(f"🔄 Starting enhanced processing cycle (mode: {schedule_info['mode']})")
            
            # Run match processing
            processing_result = self.processor.run_all_processing()
            
            # Run fixture monitoring if enabled
            fixture_result = None
            if schedule_info.get('fixture_monitoring', False):
                logger.info("📡 Running fixture monitoring...")
                fixture_result = await self.fixture_monitor.check_and_update_fixtures()
            
            # Combine results
            result = {
                "status": "success",
                "processing": processing_result,
                "fixture_monitoring": fixture_result,
                "schedule_mode": schedule_info["mode"],
                "cycle_start": cycle_start.isoformat(),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"✅ Enhanced processing cycle completed")
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
        """Main scheduler loop with fixture monitoring"""
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
                
                # Run processing cycle (async)
                if self.current_schedule:
                    # Create new event loop for async operations
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    
                    try:
                        result = loop.run_until_complete(self.run_processing_cycle())
                    finally:
                        loop.close()
                    
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