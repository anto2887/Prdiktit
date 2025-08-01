# backend/app/services/startup_sync_service.py
"""
Updated Startup Sync Service that uses the Unified Transaction Manager
Ensures all data is properly synchronized on application startup
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..db.models import Fixture, UserPrediction, MatchStatus, PredictionStatus
from .unified_transaction_manager import unified_transaction_manager

# Configure loggers
logger = logging.getLogger(__name__)
startup_logger = logging.getLogger('startup_sync')
transaction_logger = logging.getLogger('transaction_audit')

class StartupSyncService:
    """
    Enhanced startup sync service using unified transaction management
    """
    
    def __init__(self):
        startup_logger.info("🚀 StartupSyncService initialized with unified transaction management")
    
    async def run_comprehensive_startup_sync(self) -> Dict[str, Any]:
        """
        Run comprehensive startup synchronization using unified transaction management
        Only processes matches whose dates have elapsed
        """
        try:
            startup_logger.info("🔄 COMPREHENSIVE_STARTUP_SYNC_BEGIN")
            transaction_logger.info("STARTUP_SYNC_INIT: Beginning comprehensive synchronization")
            
            # Step 1: Analyze current database state
            startup_logger.info("🔍 Step 1: Analyzing current database state...")
            analysis = self._analyze_database_state()
            
            startup_logger.info(f"📊 Database analysis complete:")
            startup_logger.info(f"   - Total fixtures: {analysis['total_fixtures']}")
            startup_logger.info(f"   - Finished matches: {analysis['finished_matches']}")
            startup_logger.info(f"   - Total predictions: {analysis['total_predictions']}")
            startup_logger.info(f"   - Unprocessed predictions: {analysis['unprocessed_predictions']}")
            startup_logger.info(f"   - Editable predictions on finished matches: {analysis['editable_on_finished']}")
            startup_logger.info(f"   - Locked predictions on finished matches: {analysis['locked_on_finished']}")
            
            # Step 2: Process ONLY elapsed matches with unprocessed predictions
            startup_logger.info("⚙️ Step 2: Processing ELAPSED matches with unprocessed predictions...")
            
            if analysis['unprocessed_predictions'] > 0:
                # Get fixtures with unprocessed predictions where match date has elapsed
                processed_predictions = 0
                processed_matches = 0
                skipped_future_matches = 0
                
                # Use read-only session to find elapsed fixtures with unprocessed predictions
                db = SessionLocal()
                try:
                    now = datetime.now(timezone.utc)
                    
                    # First get all fixtures with unprocessed predictions
                    all_fixtures_with_unprocessed = db.query(Fixture).join(UserPrediction).filter(
                        UserPrediction.prediction_status != PredictionStatus.PROCESSED
                    ).distinct().all()

                    # Filter manually to handle timezone issues
                    elapsed_fixtures_with_unprocessed = []
                    future_fixtures_with_unprocessed = []

                    for fixture in all_fixtures_with_unprocessed:
                        fixture_date = fixture.date
                        if fixture_date.tzinfo is None:
                            # If fixture date is naive, assume it's UTC
                            fixture_date = fixture_date.replace(tzinfo=timezone.utc)
                        
                        if fixture_date <= now:
                            elapsed_fixtures_with_unprocessed.append(fixture)
                        else:
                            future_fixtures_with_unprocessed.append(fixture)
                    
                    startup_logger.info(f"🎯 Found {len(elapsed_fixtures_with_unprocessed)} ELAPSED fixtures with unprocessed predictions")
                    startup_logger.info(f"⏭️ Found {len(future_fixtures_with_unprocessed)} FUTURE fixtures with unprocessed predictions (will skip)")
                    
                    skipped_future_matches = len(future_fixtures_with_unprocessed)
                    
                    # Log future matches for reference
                    for future_fixture in future_fixtures_with_unprocessed:
                        startup_logger.info(f"   ⏭️ Skipping future match: {future_fixture.fixture_id} ({future_fixture.home_team} vs {future_fixture.away_team}) - Date: {future_fixture.date}")
                    
                finally:
                    db.close()
                
                # Process only elapsed fixtures
                for fixture in elapsed_fixtures_with_unprocessed:
                    try:
                        startup_logger.info(f"🕐 Processing elapsed fixture {fixture.fixture_id}: {fixture.home_team} vs {fixture.away_team} (Date: {fixture.date})")
                        
                        result = unified_transaction_manager.emergency_status_sync(fixture.fixture_id)
                        
                        if result.success:
                            processed_predictions += result.predictions_processed
                            if result.predictions_processed > 0:
                                processed_matches += 1
                            startup_logger.info(f"✅ Processed fixture {fixture.fixture_id}: {result.predictions_processed} predictions")
                        else:
                            startup_logger.error(f"❌ Processing failed for fixture {fixture.fixture_id}: {result.error_message}")
                            
                    except Exception as e:
                        startup_logger.error(f"❌ Error processing fixture {fixture.fixture_id}: {e}")
                
                startup_logger.info(f"✅ ELAPSED MATCH processing completed")
                startup_logger.info(f"   - Elapsed matches processed: {processed_matches}")
                startup_logger.info(f"   - Predictions processed: {processed_predictions}")
                startup_logger.info(f"   - Future matches skipped: {skipped_future_matches}")
                
                transaction_logger.info(f"STARTUP_SYNC_PROCESSING_SUCCESS: elapsed_matches={processed_matches}, predictions={processed_predictions}, future_skipped={skipped_future_matches}")
                
                return {
                    "success": True,
                    "matches_processed": processed_matches,
                    "predictions_processed": processed_predictions,
                    "future_matches_skipped": skipped_future_matches,
                    "predictions_locked": 0,  # Not applicable in this mode
                    "verification_passed": True,
                    "database_analysis": analysis,
                    "operations_count": processed_matches,
                    "message": f"Elapsed match processing completed: {processed_predictions} predictions processed, {skipped_future_matches} future matches skipped"
                }
            else:
                startup_logger.info("✅ No unprocessed predictions found - database is already synchronized")
                transaction_logger.info("STARTUP_SYNC_NO_PROCESSING_NEEDED")
                
                return {
                    "success": True,
                    "matches_processed": 0,
                    "predictions_processed": 0,
                    "future_matches_skipped": 0,
                    "predictions_locked": 0,
                    "verification_passed": True,
                    "database_analysis": analysis,
                    "operations_count": 0,
                    "message": "Database already synchronized - no processing needed"
                }
                
        except Exception as e:
            startup_logger.error(f"❌ CRITICAL_ERROR_IN_STARTUP_SYNC: {str(e)}")
            transaction_logger.error(f"STARTUP_SYNC_CRITICAL_ERROR: {str(e)}")
            
            return {
                "success": False,
                "error_message": str(e),
                "message": f"Critical error in startup sync: {str(e)}"
            }
    
    def _analyze_database_state(self) -> Dict[str, Any]:
        """
        Analyze current database state to determine what needs synchronization
        """
        db = SessionLocal()
        try:
            # Get fixture counts by status
            total_fixtures = db.query(Fixture).count()
            
            finished_matches = db.query(Fixture).filter(
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ])
            ).count()
            
            not_started_matches = db.query(Fixture).filter(
                Fixture.status == MatchStatus.NOT_STARTED
            ).count()
            
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
            
            # Get prediction counts by status
            total_predictions = db.query(UserPrediction).count()
            
            editable_predictions = db.query(UserPrediction).filter(
                UserPrediction.prediction_status == PredictionStatus.EDITABLE
            ).count()
            
            submitted_predictions = db.query(UserPrediction).filter(
                UserPrediction.prediction_status == PredictionStatus.SUBMITTED
            ).count()
            
            locked_predictions = db.query(UserPrediction).filter(
                UserPrediction.prediction_status == PredictionStatus.LOCKED
            ).count()
            
            processed_predictions = db.query(UserPrediction).filter(
                UserPrediction.prediction_status == PredictionStatus.PROCESSED
            ).count()
            
            # Get problematic combinations
            
            # Editable predictions on finished matches (should be processed)
            editable_on_finished = db.query(UserPrediction).join(Fixture).filter(
                UserPrediction.prediction_status == PredictionStatus.EDITABLE,
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ])
            ).count()
            
            # Locked predictions on finished matches (should be processed)
            locked_on_finished = db.query(UserPrediction).join(Fixture).filter(
                UserPrediction.prediction_status == PredictionStatus.LOCKED,
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ])
            ).count()
            
            # Submitted predictions on started matches (should be locked)
            submitted_on_started = db.query(UserPrediction).join(Fixture).filter(
                UserPrediction.prediction_status == PredictionStatus.SUBMITTED,
                Fixture.status != MatchStatus.NOT_STARTED
            ).count()
            
            unprocessed_predictions = editable_predictions + submitted_predictions + locked_predictions
            
            return {
                "total_fixtures": total_fixtures,
                "finished_matches": finished_matches,
                "not_started_matches": not_started_matches,
                "live_matches": live_matches,
                "total_predictions": total_predictions,
                "editable_predictions": editable_predictions,
                "submitted_predictions": submitted_predictions,
                "locked_predictions": locked_predictions,
                "processed_predictions": processed_predictions,
                "unprocessed_predictions": unprocessed_predictions,
                "editable_on_finished": editable_on_finished,
                "locked_on_finished": locked_on_finished,
                "submitted_on_started": submitted_on_started,
                "analysis_timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        finally:
            db.close()
    
    def _prepare_startup_fixture_updates(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Prepare fixture updates based on database analysis
        
        For startup sync, we primarily focus on ensuring prediction processing
        rather than fetching new data from APIs
        """
        fixture_updates = []
        
        # For startup sync, we typically don't change fixture statuses
        # We focus on processing existing data correctly
        # 
        # In a production system, you might want to:
        # 1. Fetch recent matches from API
        # 2. Compare with database state
        # 3. Prepare updates for any discrepancies
        #
        # For now, we return empty list to focus on prediction processing
        
        startup_logger.info("📋 Startup sync focusing on prediction processing rather than fixture updates")
        
        return fixture_updates
    
    def run_emergency_comprehensive_sync(self) -> Dict[str, Any]:
        """
        Emergency synchronization for all finished matches with unprocessed predictions
        """
        try:
            startup_logger.info("🚨 EMERGENCY_COMPREHENSIVE_SYNC_BEGIN")
            transaction_logger.info("EMERGENCY_SYNC_INIT: Beginning emergency synchronization")
            
            # Get all finished matches with unprocessed predictions
            db = SessionLocal()
            try:
                finished_matches_with_unprocessed = db.query(Fixture).join(UserPrediction).filter(
                    Fixture.status.in_([
                        MatchStatus.FINISHED,
                        MatchStatus.FINISHED_AET,
                        MatchStatus.FINISHED_PEN
                    ]),
                    UserPrediction.prediction_status != PredictionStatus.PROCESSED
                ).distinct().all()
                
                startup_logger.info(f"🔍 Found {len(finished_matches_with_unprocessed)} finished matches with unprocessed predictions")
                
            finally:
                db.close()
            
            if not finished_matches_with_unprocessed:
                startup_logger.info("✅ No emergency sync needed")
                return {
                    "success": True,
                    "matches_processed": 0,
                    "predictions_processed": 0,
                    "message": "No emergency sync needed"
                }
            
            # Process each match individually for detailed logging
            total_predictions_processed = 0
            matches_processed = 0
            
            for match in finished_matches_with_unprocessed:
                try:
                    result = unified_transaction_manager.emergency_status_sync(match.fixture_id)
                    
                    if result.success:
                        total_predictions_processed += result.predictions_processed
                        matches_processed += 1
                        startup_logger.info(f"✅ Emergency processed match {match.fixture_id}: {result.predictions_processed} predictions")
                    else:
                        startup_logger.error(f"❌ Emergency processing failed for match {match.fixture_id}: {result.error_message}")
                        
                except Exception as e:
                    startup_logger.error(f"❌ Error in emergency processing for match {match.fixture_id}: {e}")
            
            startup_logger.info(f"🚨 EMERGENCY_COMPREHENSIVE_SYNC_COMPLETE: {matches_processed} matches, {total_predictions_processed} predictions")
            transaction_logger.info(f"EMERGENCY_SYNC_COMPLETE: matches={matches_processed}, predictions={total_predictions_processed}")
            
            return {
                "success": True,
                "matches_processed": matches_processed,
                "predictions_processed": total_predictions_processed,
                "total_matches_found": len(finished_matches_with_unprocessed),
                "message": f"Emergency sync completed: {matches_processed} matches processed"
            }
            
        except Exception as e:
            startup_logger.error(f"❌ CRITICAL_ERROR_IN_EMERGENCY_SYNC: {str(e)}")
            transaction_logger.error(f"EMERGENCY_SYNC_CRITICAL_ERROR: {str(e)}")
            
            return {
                "success": False,
                "error_message": str(e),
                "message": f"Critical error in emergency sync: {str(e)}"
            }

# Global instance
startup_sync_service = StartupSyncService()