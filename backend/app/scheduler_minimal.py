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
from app.db.database import SessionLocal
from app.db.models import Fixture, MatchStatus

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
        self.next_fixture_check_at = None
        self.error_count = 0
        self.max_errors = 5
        self.error_reset_time = None
        self.notification_scheduler = None
        self.last_reminder_check = None  # Track 15min reminder window
        self.final_statuses = [
            MatchStatus.FINISHED,
            MatchStatus.FINISHED_AET,
            MatchStatus.FINISHED_PEN,
        ]
        self.daily_state = {
            "day_utc": None,
            "initialized": False,
            "has_matches_today": False,
            "done_for_day": False,
            "first_kickoff_utc": None,
            "last_kickoff_utc": None,
            "today_matches": 0,
            "finalized_matches": 0,
        }

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

        # Import NotificationScheduler (for email notifications)
        try:
            from app.services.notification_scheduler import notification_scheduler
            self.notification_scheduler = notification_scheduler
            logger.info("✅ Successfully imported NotificationScheduler")
        except ImportError as e:
            logger.error(f"❌ Failed to import NotificationScheduler: {e}")
            self.notification_scheduler = None

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
        """Run a single scheduling cycle with actual fixture and notification processing"""
        try:
            if not self.is_running or not self.scheduler or not self.match_updater:
                return False

            current_time = datetime.now(timezone.utc)
            self._ensure_daily_state(current_time)

            if self.next_fixture_check_at is None or current_time >= self.next_fixture_check_at:
                logger.info(
                    "🔄 Running scheduling cycle with fixture processing... "
                    f"(mode={self._get_mode_label(current_time)})"
                )

                next_seconds = await self._process_fixtures(current_time)
                self.next_fixture_check_at = current_time + timedelta(seconds=next_seconds)
                logger.info(
                    f"⏭️ Next fixture cycle in {next_seconds}s at {self.next_fixture_check_at.isoformat()}"
                )

                self.last_check = current_time
                self.error_count = 0  # Reset error count on success

                # Process notification queue and match result jobs every 5 minutes
                if self.notification_scheduler:
                    try:
                        await self.notification_scheduler.process_notification_queue()
                        self.notification_scheduler.check_and_queue_match_results()
                        logger.info("✅ Notification queue processed")
                    except Exception as e:
                        logger.error(f"❌ Notification queue error (non-fatal): {e}")

            # Check reminders every 15 minutes independently
            if self.notification_scheduler and (
                self.last_reminder_check is None
                or (current_time - self.last_reminder_check).total_seconds() > 900
            ):
                try:
                    self.notification_scheduler.check_and_queue_reminders()
                    self.last_reminder_check = current_time
                    logger.info("✅ Reminder check completed")
                except Exception as e:
                    logger.error(f"❌ Reminder check error (non-fatal): {e}")

            return True

        except Exception as e:
            self.error_count += 1
            logger.error(f"❌ Error in scheduling cycle {self.error_count}: {e}")

            # Implement circuit breaker pattern
            if self.error_count >= self.max_errors:
                logger.error(
                    f"🚨 Circuit breaker activated after {self.error_count} errors"
                )
                self.is_running = False
                scheduler_status = "circuit_breaker"
                return False

            return False

    def _utc_day_bounds(self, now: datetime):
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        return start, end

    def _ensure_daily_state(self, now: datetime):
        day = now.date().isoformat()
        if self.daily_state["day_utc"] == day and self.daily_state["initialized"]:
            return
        self.daily_state.update({
            "day_utc": day,
            "initialized": True,
            "has_matches_today": False,
            "done_for_day": False,
            "first_kickoff_utc": None,
            "last_kickoff_utc": None,
            "today_matches": 0,
            "finalized_matches": 0,
        })
        self._refresh_today_db_state(now)
        logger.info(
            "🗓️ Initialized UTC daily state: "
            f"day={day}, has_matches_today={self.daily_state['has_matches_today']}, "
            f"today_matches={self.daily_state['today_matches']}"
        )

    def _refresh_today_db_state(self, now: datetime):
        start, end = self._utc_day_bounds(now)
        db = SessionLocal()
        try:
            fixtures = db.query(Fixture).filter(
                Fixture.date >= start,
                Fixture.date < end,
            ).all()
            self.daily_state["today_matches"] = len(fixtures)
            self.daily_state["has_matches_today"] = len(fixtures) > 0

            if fixtures:
                sorted_dates = sorted([f.date if f.date.tzinfo else f.date.replace(tzinfo=timezone.utc) for f in fixtures])
                self.daily_state["first_kickoff_utc"] = sorted_dates[0]
                self.daily_state["last_kickoff_utc"] = sorted_dates[-1]

            finalized = 0
            for fx in fixtures:
                if fx.status in self.final_statuses and fx.home_score is not None and fx.away_score is not None:
                    finalized += 1
            self.daily_state["finalized_matches"] = finalized
            self.daily_state["done_for_day"] = (
                self.daily_state["has_matches_today"]
                and finalized == len(fixtures)
            )
        finally:
            db.close()

    def _get_mode_label(self, now: datetime) -> str:
        self._refresh_today_db_state(now)
        if not self.daily_state["has_matches_today"]:
            return "non_match_day"
        if self.daily_state["done_for_day"]:
            return "done_for_day"
        db = SessionLocal()
        try:
            live_count = db.query(Fixture).filter(
                Fixture.status.in_([
                    MatchStatus.FIRST_HALF,
                    MatchStatus.SECOND_HALF,
                    MatchStatus.HALFTIME,
                    MatchStatus.EXTRA_TIME,
                    MatchStatus.PENALTY,
                    MatchStatus.LIVE,
                ])
            ).count()
            if live_count > 0:
                return "live_matches"
            soon = now + timedelta(hours=2)
            soon_count = db.query(Fixture).filter(
                Fixture.date >= now,
                Fixture.date <= soon,
                Fixture.status == MatchStatus.NOT_STARTED
            ).count()
            if soon_count > 0:
                return "matches_starting_soon"
            return "match_day"
        finally:
            db.close()

    async def _process_fixtures(self, now: datetime):
        """Process fixtures using existing backend services"""
        try:
            if not self.scheduler or not self.match_updater:
                logger.error("❌ Required services not available")
                return 300

            mode = self._get_mode_label(now)

            if mode == "non_match_day":
                logger.info("🧭 Non-match day: running lightweight fixture schedule sync only")
                await self.match_updater.update_recent_matches(
                    days_back=0,
                    days_forward=2,
                    process_predictions=False,
                )
                self._refresh_today_db_state(now)
                return 43200  # 12h

            if mode == "done_for_day":
                logger.info("✅ Day complete: all today's matches finalized; backing off checks")
                return 43200  # 12h

            logger.info(f"🚀 Running enhanced processing cycle with API updates (mode={mode})...")
            try:
                result = await self.scheduler.run_enhanced_processing_with_status_updates(
                    run_secondary_processing=False
                )

                if result.get('status') == 'success':
                    logger.info("✅ Enhanced processing completed successfully:")
                    logger.info(f"   - Fixtures updated: {result.get('fixtures_updated', 0)}")
                    logger.info(f"   - Predictions locked: {result.get('predictions_locked', 0)}")
                    logger.info(f"   - Predictions processed: {result.get('predictions_processed', 0)}")
                else:
                    logger.warning(
                        f"⚠️ Enhanced processing had issues: {result.get('error_message', 'Unknown error')}"
                    )
            except Exception as e:
                logger.error(f"❌ Error in enhanced processing: {e}")
                # Fallback to manual processing if enhanced method fails
                await self._fallback_processing()
            self._refresh_today_db_state(now)
            # Adaptive cadence on match days
            if mode == "live_matches":
                return 120
            if mode == "matches_starting_soon":
                return 300
            return 900
        except Exception as e:
            logger.error(f"❌ Error processing fixtures: {e}")
            raise
    
    async def _fallback_processing(self):
        """Fallback processing if enhanced method fails"""
        try:
            logger.info("🔄 Running fallback processing...")
            
            # Step 1: Update match statuses from Football API
            logger.info("📡 Fetching fresh match data from Football API...")
            
            try:
                # Update matches (last 3 days + next 14 days) for status updates and future fixtures
                recent_updates = await self.match_updater.update_recent_matches(days_back=3, days_forward=14)
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
                schedule = self.scheduler._calculate_dynamic_schedule()
                logger.info(f"📅 Current schedule: {schedule['mode']} mode - {schedule['reason']}")
                
                # Run the processing cycle to handle predictions
                self.scheduler._run_processing_cycle(schedule)
                
                logger.info("✅ Fallback processing completed successfully")
            except Exception as e:
                logger.error(f"❌ Error in fallback processing: {e}")
            
        except Exception as e:
            logger.error(f"❌ Error in fallback processing: {e}")
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
        logger.info("📡 Running scheduling cycles with UTC daily state machine...")
        
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
        "service": "scheduler",
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
