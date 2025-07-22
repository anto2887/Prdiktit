# backend/app/services/match_processor.py
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..db.database import SessionLocal
from ..db.models import Fixture, UserPrediction, UserResults, MatchStatus, PredictionStatus
from ..db.repository import calculate_points

# Create a dedicated logger for match processing
logger = logging.getLogger(__name__)

# Create a separate logger for audit trail
audit_logger = logging.getLogger('match_processing_audit')

class MatchProcessor:
    """Handles match and prediction processing for PostgreSQL database"""
    
    def __init__(self):
        self.db = SessionLocal()
        
        # Set up audit logging if not already configured
        if not audit_logger.handlers:
            # Create file handler for audit logs
            import os
            log_dir = os.path.join(os.path.dirname(__file__), '../../logs')
            os.makedirs(log_dir, exist_ok=True)
            
            audit_handler = logging.FileHandler(os.path.join(log_dir, 'match_processing_audit.log'))
            audit_formatter = logging.Formatter(
                '%(asctime)s - %(levelname)s - %(message)s'
            )
            audit_handler.setFormatter(audit_formatter)
            audit_logger.addHandler(audit_handler)
            audit_logger.setLevel(logging.INFO)
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def get_completed_matches(self) -> List[Fixture]:
        """Get all completed matches that need processing"""
        try:
            completed_statuses = [
                MatchStatus.FINISHED,
                MatchStatus.FINISHED_AET,
                MatchStatus.FINISHED_PEN
            ]
            
            # Get completed matches that haven't been processed yet
            completed_matches = []
            
            matches = self.db.query(Fixture).filter(
                Fixture.status.in_(completed_statuses),
                Fixture.home_score.isnot(None),
                Fixture.away_score.isnot(None)
            ).all()
            
            logger.info(f"🔍 Found {len(matches)} completed matches in database")
            
            for match in matches:
                # Check if this match has any LOCKED predictions (meaning it needs processing)
                locked_predictions = self.db.query(UserPrediction).filter(
                    UserPrediction.fixture_id == match.fixture_id,
                    UserPrediction.prediction_status == PredictionStatus.LOCKED
                ).first()
                
                if locked_predictions:
                    completed_matches.append(match)
                    logger.debug(f"✅ Match {match.fixture_id} ({match.home_team} vs {match.away_team}) needs processing")
                else:
                    logger.debug(f"⏭️ Match {match.fixture_id} ({match.home_team} vs {match.away_team}) already processed")
            
            logger.info(f"📊 Found {len(completed_matches)} completed matches needing processing")
            audit_logger.info(f"SCAN_COMPLETED_MATCHES: found {len(completed_matches)} matches needing processing")
            
            return completed_matches
            
        except Exception as e:
            logger.error(f"❌ Error getting completed matches: {e}")
            audit_logger.error(f"SCAN_ERROR: {str(e)}")
            return []
    
    def get_upcoming_matches_for_locking(self) -> List[Fixture]:
        """Get matches ready for prediction locking (kickoff time reached)"""
        try:
            # CRITICAL: Use UTC for all time comparisons
            now_utc = datetime.now(timezone.utc)
            
            upcoming_matches = self.db.query(Fixture).filter(
                Fixture.status == MatchStatus.NOT_STARTED,
                Fixture.date <= now_utc  # Kickoff time has passed (UTC)
            ).all()
            
            logger.info(f"🔒 Found {len(upcoming_matches)} matches ready for locking (UTC time: {now_utc})")
            audit_logger.info(f"SCAN_LOCKING_MATCHES: found {len(upcoming_matches)} matches ready for locking at {now_utc}")
            
            return upcoming_matches
            
        except Exception as e:
            logger.error(f"❌ Error getting upcoming matches: {e}")
            audit_logger.error(f"SCAN_LOCKING_ERROR: {str(e)}")
            return []
    
    def lock_predictions_for_match(self, fixture_id: int) -> int:
        """Lock all SUBMITTED predictions for a specific match"""
        try:
            # Get match details for logging
            match = self.db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()
            match_name = f"{match.home_team} vs {match.away_team}" if match else f"Match {fixture_id}"
            
            # Get all submitted predictions for this match
            submitted_predictions = self.db.query(UserPrediction).filter(
                UserPrediction.fixture_id == fixture_id,
                UserPrediction.prediction_status == PredictionStatus.SUBMITTED
            ).all()
            
            locked_count = 0
            for prediction in submitted_predictions:
                prediction.prediction_status = PredictionStatus.LOCKED
                locked_count += 1
            
            self.db.commit()
            
            logger.info(f"🔒 Locked {locked_count} predictions for fixture {fixture_id} ({match_name})")
            audit_logger.info(f"LOCK_PREDICTIONS: fixture_id={fixture_id}, match='{match_name}', predictions_locked={locked_count}")
            
            return locked_count
            
        except Exception as e:
            logger.error(f"❌ Error locking predictions for fixture {fixture_id}: {e}")
            audit_logger.error(f"LOCK_ERROR: fixture_id={fixture_id}, error='{str(e)}'")
            self.db.rollback()
            return 0
    
    def process_match_predictions(self, fixture: Fixture) -> int:
        """Process all predictions for a completed match with detailed logging"""
        match_name = f"{fixture.home_team} vs {fixture.away_team}"
        final_score = f"{fixture.home_score}-{fixture.away_score}"
        
        try:
            logger.info(f"🏈 Starting processing for match {fixture.fixture_id}: {match_name} (Final: {final_score})")
            audit_logger.info(f"PROCESS_START: fixture_id={fixture.fixture_id}, match='{match_name}', final_score='{final_score}', status='{fixture.status.value}'")
            
            # Get all locked predictions for this match
            locked_predictions = self.db.query(UserPrediction).filter(
                UserPrediction.fixture_id == fixture.fixture_id,
                UserPrediction.prediction_status == PredictionStatus.LOCKED
            ).all()
            
            if not locked_predictions:
                logger.warning(f"⚠️ No locked predictions found for fixture {fixture.fixture_id}")
                audit_logger.warning(f"PROCESS_NO_PREDICTIONS: fixture_id={fixture.fixture_id}, match='{match_name}'")
                return 0
            
            logger.info(f"📊 Processing {len(locked_predictions)} predictions for match {fixture.fixture_id}")
            
            processed_count = 0
            points_distribution = {"0_points": 0, "1_point": 0, "3_points": 0}
            
            for prediction in locked_predictions:
                try:
                    # Calculate points
                    points = calculate_points(
                        prediction.score1,
                        prediction.score2,
                        fixture.home_score,
                        fixture.away_score
                    )
                    
                    # Track points distribution
                    if points == 0:
                        points_distribution["0_points"] += 1
                    elif points == 1:
                        points_distribution["1_point"] += 1
                    elif points == 3:
                        points_distribution["3_points"] += 1
                    
                    # Update prediction
                    prediction.points = points
                    prediction.prediction_status = PredictionStatus.PROCESSED
                    prediction.processed_at = datetime.now(timezone.utc)
                    
                    # Update or create user results
                    user_result = self.db.query(UserResults).filter(
                        UserResults.user_id == prediction.user_id,
                        UserResults.season == prediction.season
                    ).first()
                    
                    if not user_result:
                        user_result = UserResults(
                            user_id=prediction.user_id,
                            points=0,
                            season=prediction.season,
                            week=prediction.week
                        )
                        self.db.add(user_result)
                    
                    user_result.points += points
                    processed_count += 1
                    
                    logger.debug(f"✅ Processed prediction {prediction.id}: user={prediction.user_id}, predicted={prediction.score1}-{prediction.score2}, points={points}")
                    
                except Exception as e:
                    logger.error(f"❌ Error processing prediction {prediction.id}: {e}")
                    audit_logger.error(f"PREDICTION_ERROR: prediction_id={prediction.id}, user_id={prediction.user_id}, error='{str(e)}'")
                    continue
            
            self.db.commit()
            
            # Log comprehensive results
            logger.info(f"✅ Successfully processed {processed_count} predictions for match {fixture.fixture_id}")
            logger.info(f"📈 Points distribution: {points_distribution['3_points']} perfect scores, {points_distribution['1_point']} correct results, {points_distribution['0_points']} incorrect")
            
            audit_logger.info(f"PROCESS_SUCCESS: fixture_id={fixture.fixture_id}, match='{match_name}', predictions_processed={processed_count}, perfect_scores={points_distribution['3_points']}, correct_results={points_distribution['1_point']}, incorrect={points_distribution['0_points']}")
            
            return processed_count
            
        except Exception as e:
            logger.error(f"❌ Critical error processing predictions for fixture {fixture.fixture_id}: {e}")
            audit_logger.error(f"PROCESS_CRITICAL_ERROR: fixture_id={fixture.fixture_id}, match='{match_name}', error='{str(e)}'")
            self.db.rollback()
            return 0
    
    def run_prediction_locking(self) -> Dict[str, Any]:
        """Lock predictions for matches that have reached kickoff"""
        start_time = datetime.now(timezone.utc)
        logger.info(f"🚀 Starting prediction locking cycle at {start_time}")
        audit_logger.info(f"LOCKING_CYCLE_START: timestamp={start_time.isoformat()}")
        
        try:
            upcoming_matches = self.get_upcoming_matches_for_locking()
            total_locked = 0
            matches_processed = 0
            successful_locks = []
            failed_locks = []
            
            for match in upcoming_matches:
                try:
                    locked_count = self.lock_predictions_for_match(match.fixture_id)
                    total_locked += locked_count
                    matches_processed += 1
                    successful_locks.append({
                        "fixture_id": match.fixture_id,
                        "match": f"{match.home_team} vs {match.away_team}",
                        "predictions_locked": locked_count
                    })
                except Exception as e:
                    failed_locks.append({
                        "fixture_id": match.fixture_id,
                        "match": f"{match.home_team} vs {match.away_team}",
                        "error": str(e)
                    })
                    logger.error(f"❌ Failed to lock predictions for match {match.fixture_id}: {e}")
            
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            result = {
                "status": "success",
                "matches_processed": matches_processed,
                "predictions_locked": total_locked,
                "successful_locks": len(successful_locks),
                "failed_locks": len(failed_locks),
                "duration_seconds": duration,
                "timestamp": end_time.isoformat()
            }
            
            logger.info(f"🎯 Prediction locking complete: {matches_processed} matches processed, {total_locked} predictions locked in {duration:.2f}s")
            audit_logger.info(f"LOCKING_CYCLE_COMPLETE: {result}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Critical error in prediction locking: {e}")
            audit_logger.error(f"LOCKING_CYCLE_ERROR: error='{str(e)}'")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    def run_match_processing(self) -> Dict[str, Any]:
        """Process completed matches and calculate prediction points"""
        start_time = datetime.now(timezone.utc)
        logger.info(f"🚀 Starting match processing cycle at {start_time}")
        audit_logger.info(f"PROCESSING_CYCLE_START: timestamp={start_time.isoformat()}")
        
        try:
            completed_matches = self.get_completed_matches()
            total_processed = 0
            matches_completed = 0
            successful_processing = []
            failed_processing = []
            
            for match in completed_matches:
                try:
                    processed_count = self.process_match_predictions(match)
                    total_processed += processed_count
                    matches_completed += 1
                    successful_processing.append({
                        "fixture_id": match.fixture_id,
                        "match": f"{match.home_team} vs {match.away_team}",
                        "final_score": f"{match.home_score}-{match.away_score}",
                        "predictions_processed": processed_count
                    })
                except Exception as e:
                    failed_processing.append({
                        "fixture_id": match.fixture_id,
                        "match": f"{match.home_team} vs {match.away_team}",
                        "error": str(e)
                    })
                    logger.error(f"❌ Failed to process match {match.fixture_id}: {e}")
            
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            result = {
                "status": "success",
                "matches_completed": matches_completed,
                "predictions_processed": total_processed,
                "successful_processing": len(successful_processing),
                "failed_processing": len(failed_processing),
                "duration_seconds": duration,
                "timestamp": end_time.isoformat(),
                "processed_matches": successful_processing,
                "failed_matches": failed_processing
            }
            
            logger.info(f"🎯 Match processing complete: {matches_completed} matches processed, {total_processed} predictions in {duration:.2f}s")
            audit_logger.info(f"PROCESSING_CYCLE_COMPLETE: {result}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Critical error in match processing: {e}")
            audit_logger.error(f"PROCESSING_CYCLE_ERROR: error='{str(e)}'")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    def run_all_processing(self) -> Dict[str, Any]:
        """Run both prediction locking and match processing"""
        cycle_start = datetime.now(timezone.utc)
        logger.info(f"🔄 Starting full processing cycle at {cycle_start}")
        audit_logger.info(f"FULL_CYCLE_START: timestamp={cycle_start.isoformat()}")
        
        try:
            # First lock predictions for matches at kickoff
            locking_result = self.run_prediction_locking()
            
            # Then process completed matches
            processing_result = self.run_match_processing()
            
            cycle_end = datetime.now(timezone.utc)
            total_duration = (cycle_end - cycle_start).total_seconds()
            
            result = {
                "status": "success",
                "locking": locking_result,
                "processing": processing_result,
                "total_duration_seconds": total_duration,
                "timestamp": cycle_end.isoformat()
            }
            
            logger.info(f"🏁 Full processing cycle complete in {total_duration:.2f}s")
            audit_logger.info(f"FULL_CYCLE_COMPLETE: duration={total_duration:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Critical error in full processing: {e}")
            audit_logger.error(f"FULL_CYCLE_ERROR: error='{str(e)}'")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }