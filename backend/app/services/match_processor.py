# backend/app/services/match_processor.py
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..db.database import SessionLocal
from ..db.models import Fixture, UserPrediction, UserResults, MatchStatus, PredictionStatus
from ..db.repository import calculate_points
logger = logging.getLogger(__name__)
class MatchProcessor:
    """Handles match and prediction processing for PostgreSQL database"""
    
    def __init__(self):
        self.db = SessionLocal()
    
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
            # Since we removed the 'processed' column, we'll check if predictions are still LOCKED
            completed_matches = []
            
            matches = self.db.query(Fixture).filter(
                Fixture.status.in_(completed_statuses),
                Fixture.home_score.isnot(None),
                Fixture.away_score.isnot(None)
            ).all()
            
            for match in matches:
                # Check if this match has any LOCKED predictions (meaning it needs processing)
                locked_predictions = self.db.query(UserPrediction).filter(
                    UserPrediction.fixture_id == match.fixture_id,
                    UserPrediction.prediction_status == PredictionStatus.LOCKED
                ).first()
                
                if locked_predictions:
                    completed_matches.append(match)
            
            logger.info(f"Found {len(completed_matches)} completed matches needing processing")
            return completed_matches
            
        except Exception as e:
            logger.error(f"Error getting completed matches: {e}")
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
            
            logger.info(f"Found {len(upcoming_matches)} matches ready for locking (UTC time: {now_utc})")
            return upcoming_matches
            
        except Exception as e:
            logger.error(f"Error getting upcoming matches: {e}")
            return []
    
    def lock_predictions_for_match(self, fixture_id: int) -> int:
        """Lock all SUBMITTED predictions for a specific match"""
        try:
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
            logger.info(f"Locked {locked_count} predictions for fixture {fixture_id}")
            return locked_count
            
        except Exception as e:
            logger.error(f"Error locking predictions for fixture {fixture_id}: {e}")
            self.db.rollback()
            return 0
    
    def process_match_predictions(self, fixture: Fixture) -> int:
        """Process predictions for a completed match"""
        try:
            # Update prediction processing timestamp
            processed_time_utc = datetime.now(timezone.utc)
            
            # Process locked predictions and update with UTC timestamp
            locked_predictions = self.db.query(UserPrediction).filter(
                UserPrediction.fixture_id == fixture.fixture_id,
                UserPrediction.prediction_status == PredictionStatus.LOCKED
            ).all()
            processed_count = 0
            for prediction in locked_predictions:
                prediction.points = calculate_points(
                    prediction.score1,
                    prediction.score2,
                    fixture.home_score,
                    fixture.away_score
                )
                prediction.prediction_status = PredictionStatus.PROCESSED
                prediction.processed_at = processed_time_utc  # UTC timestamp
                processed_count += 1
            self.db.commit()
            return processed_count
            
        except Exception as e:
            logger.error(f"Error processing predictions: {e}")
            return 0
    
    def run_prediction_locking(self) -> Dict[str, Any]:
        """Lock predictions for matches that have reached kickoff"""
        try:
            upcoming_matches = self.get_upcoming_matches_for_locking()
            total_locked = 0
            matches_processed = 0
            
            for match in upcoming_matches:
                locked_count = self.lock_predictions_for_match(match.fixture_id)
                total_locked += locked_count
                matches_processed += 1
            
            result = {
                "status": "success",
                "matches_processed": matches_processed,
                "predictions_locked": total_locked,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Prediction locking complete: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error in prediction locking: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    def run_match_processing(self) -> Dict[str, Any]:
        """Process completed matches and calculate prediction points"""
        try:
            completed_matches = self.get_completed_matches()
            total_processed = 0
            matches_completed = 0
            
            for match in completed_matches:
                processed_count = self.process_match_predictions(match)
                total_processed += processed_count
                matches_completed += 1
            
            result = {
                "status": "success",
                "matches_completed": matches_completed,
                "predictions_processed": total_processed,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Match processing complete: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error in match processing: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    def run_all_processing(self) -> Dict[str, Any]:
        """Run both prediction locking and match processing"""
        try:
            # First lock predictions for matches at kickoff
            locking_result = self.run_prediction_locking()
            
            # Then process completed matches
            processing_result = self.run_match_processing()
            
            return {
                "status": "success",
                "locking": locking_result,
                "processing": processing_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in full processing: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }