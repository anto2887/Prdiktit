# backend/app/services/unified_transaction_manager.py
"""
Unified Transaction Manager - Consolidates all database operations into a single session
with comprehensive logging and verification.

This replaces the scattered session management across multiple services.
"""

import logging
import traceback
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple, Union
from contextlib import contextmanager
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from ..db.database import SessionLocal
from ..db.models import Fixture, UserPrediction, MatchStatus, PredictionStatus
from ..db.repository import calculate_points

# Configure specialized loggers
logger = logging.getLogger(__name__)
transaction_logger = logging.getLogger('transaction_audit')
verification_logger = logging.getLogger('database_verification')

class TransactionResult:
    """Encapsulates the result of a database transaction"""
    
    def __init__(self):
        self.success = False
        self.error_message = None
        self.fixtures_updated = 0
        self.predictions_locked = 0
        self.predictions_processed = 0
        self.verification_passed = False
        self.operations_log = []
        self.rollback_reason = None
        
    def add_operation(self, operation: str, details: Dict[str, Any]):
        """Add an operation to the transaction log"""
        self.operations_log.append({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'operation': operation,
            'details': details
        })
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary for logging"""
        return {
            'success': self.success,
            'error_message': self.error_message,
            'fixtures_updated': self.fixtures_updated,
            'predictions_locked': self.predictions_locked,
            'predictions_processed': self.predictions_processed,
            'verification_passed': self.verification_passed,
            'operations_count': len(self.operations_log),
            'rollback_reason': self.rollback_reason
        }

class UnifiedTransactionManager:
    """
    Manages all database operations in a single session with comprehensive logging
    """
    
    def __init__(self):
        self.session: Optional[Session] = None
        self.transaction_id = None
        
    @contextmanager
    def transaction_scope(self, operation_name: str):
        """
        Context manager for database transactions with full lifecycle logging
        """
        self.transaction_id = f"{operation_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}"
        result = TransactionResult()
        
        transaction_logger.info(f"TRANSACTION_START: {self.transaction_id} - {operation_name}")
        
        self.session = SessionLocal()
        try:
            yield self.session, result
            
            # Pre-commit verification
            transaction_logger.info(f"TRANSACTION_PRE_COMMIT: {self.transaction_id}")
            self._log_pending_changes()
            
            # Commit the transaction
            self.session.commit()
            transaction_logger.info(f"TRANSACTION_COMMITTED: {self.transaction_id}")
            
            # Post-commit verification
            verification_success = self._verify_transaction(result)
            result.verification_passed = verification_success
            result.success = True
            
            if verification_success:
                transaction_logger.info(f"TRANSACTION_VERIFIED: {self.transaction_id} - All changes persisted correctly")
            else:
                transaction_logger.error(f"TRANSACTION_VERIFICATION_FAILED: {self.transaction_id} - Changes may not have persisted")
                
        except Exception as e:
            result.success = False
            result.error_message = str(e)
            result.rollback_reason = f"Exception: {type(e).__name__}: {str(e)}"
            
            transaction_logger.error(f"TRANSACTION_ERROR: {self.transaction_id} - {str(e)}")
            transaction_logger.error(f"TRANSACTION_TRACEBACK: {self.transaction_id} - {traceback.format_exc()}")
            
            try:
                self.session.rollback()
                transaction_logger.info(f"TRANSACTION_ROLLED_BACK: {self.transaction_id}")
            except Exception as rollback_error:
                transaction_logger.error(f"ROLLBACK_FAILED: {self.transaction_id} - {str(rollback_error)}")
                
        finally:
            try:
                self.session.close()
                transaction_logger.info(f"TRANSACTION_SESSION_CLOSED: {self.transaction_id}")
            except Exception as close_error:
                transaction_logger.error(f"SESSION_CLOSE_ERROR: {self.transaction_id} - {str(close_error)}")
            
            # Final transaction summary
            transaction_logger.info(f"TRANSACTION_SUMMARY: {self.transaction_id} - {result.to_dict()}")
            
            self.session = None
            self.transaction_id = None
    
    def _log_pending_changes(self):
        """Log all pending changes before commit"""
        if not self.session:
            return

        # Log new objects
        for obj in self.session.new:
            transaction_logger.debug(f"PENDING_INSERT: {self.transaction_id} - {type(obj).__name__} {getattr(obj, 'id', 'no_id')}")

        # Log modified objects
        for obj in self.session.dirty:
            changes = {}
            # Safely get object attributes that may have changed
            if hasattr(obj, 'home_score'):
                changes['home_score'] = getattr(obj, 'home_score', None)
            if hasattr(obj, 'away_score'):
                changes['away_score'] = getattr(obj, 'away_score', None)
            if hasattr(obj, 'status'):
                status = getattr(obj, 'status', None)
                changes['status'] = status.value if hasattr(status, 'value') else status
            if hasattr(obj, 'prediction_status'):
                pred_status = getattr(obj, 'prediction_status', None)
                changes['prediction_status'] = pred_status.value if hasattr(pred_status, 'value') else pred_status

            if changes:
                transaction_logger.debug(f"PENDING_UPDATE: {self.transaction_id} - {type(obj).__name__} {getattr(obj, 'id', 'no_id')} - {changes}")

        # Log deleted objects
        for obj in self.session.deleted:
            transaction_logger.debug(f"PENDING_DELETE: {self.transaction_id} - {type(obj).__name__} {getattr(obj, 'id', 'no_id')}")
    
    def _verify_transaction(self, result: TransactionResult) -> bool:
        """
        Verify that all changes were actually persisted to the database
        """
        verification_logger.info(f"VERIFICATION_START: {self.transaction_id}")
        
        try:
            # Create a fresh session to verify persistence
            verification_session = SessionLocal()
            verification_passed = True
            
            try:
                # Verify fixture updates
                if result.fixtures_updated > 0:
                    for op in result.operations_log:
                        if op['operation'] == 'fixture_update':
                            fixture_id = op['details']['fixture_id']
                            expected_status = op['details']['new_status']
                            expected_home_score = op['details'].get('new_home_score')
                            expected_away_score = op['details'].get('new_away_score')
                            
                            # Verify the fixture was actually updated
                            fixture = verification_session.query(Fixture).filter(
                                Fixture.fixture_id == fixture_id
                            ).first()
                            
                            if not fixture:
                                verification_logger.error(f"VERIFICATION_FAILED: Fixture {fixture_id} not found")
                                verification_passed = False
                                continue
                                
                            if fixture.status.value != expected_status:
                                verification_logger.error(f"VERIFICATION_FAILED: Fixture {fixture_id} status is {fixture.status.value}, expected {expected_status}")
                                verification_passed = False
                                
                            if expected_home_score is not None and fixture.home_score != expected_home_score:
                                verification_logger.error(f"VERIFICATION_FAILED: Fixture {fixture_id} home_score is {fixture.home_score}, expected {expected_home_score}")
                                verification_passed = False
                                
                            if expected_away_score is not None and fixture.away_score != expected_away_score:
                                verification_logger.error(f"VERIFICATION_FAILED: Fixture {fixture_id} away_score is {fixture.away_score}, expected {expected_away_score}")
                                verification_passed = False
                
                # Verify prediction updates
                if result.predictions_locked > 0 or result.predictions_processed > 0:
                    for op in result.operations_log:
                        if op['operation'] in ['prediction_lock', 'prediction_process']:
                            prediction_id = op['details']['prediction_id']
                            expected_status = op['details']['new_status']
                            
                            # Verify the prediction was actually updated
                            prediction = verification_session.query(UserPrediction).filter(
                                UserPrediction.id == prediction_id
                            ).first()
                            
                            if not prediction:
                                verification_logger.error(f"VERIFICATION_FAILED: Prediction {prediction_id} not found")
                                verification_passed = False
                                continue
                                
                            if prediction.prediction_status.value != expected_status:
                                verification_logger.error(f"VERIFICATION_FAILED: Prediction {prediction_id} status is {prediction.prediction_status.value}, expected {expected_status}")
                                verification_passed = False
                
                if verification_passed:
                    verification_logger.info(f"VERIFICATION_SUCCESS: {self.transaction_id} - All changes verified in database")
                else:
                    verification_logger.error(f"VERIFICATION_FAILED: {self.transaction_id} - Some changes not persisted correctly")
                    
                return verification_passed
                
            finally:
                verification_session.close()
                
        except Exception as e:
            verification_logger.error(f"VERIFICATION_ERROR: {self.transaction_id} - {str(e)}")
            return False
    
    def update_match_statuses_and_process_predictions(self, 
                                                     fixture_updates: List[Dict[str, Any]]) -> TransactionResult:
        """
        Update match statuses and process predictions in a single transaction
        
        Args:
            fixture_updates: List of fixture update dictionaries with keys:
                - fixture_id: int
                - status: MatchStatus (optional)
                - home_score: int (optional) 
                - away_score: int (optional)
        """
        with self.transaction_scope("update_matches_and_process_predictions") as (session, result):
            
            # Step 1: Update fixture statuses and scores (or create if missing)
            for update in fixture_updates:
                fixture_id = update['fixture_id']
                
                # Get the fixture
                fixture = session.query(Fixture).filter(
                    Fixture.fixture_id == fixture_id
                ).first()
                
                # If fixture doesn't exist, create it from full fixture data
                fixture_created = False
                if not fixture:
                    if 'full_fixture_data' in update:
                        try:
                            fixture_data = update['full_fixture_data']
                            fixture = Fixture(**fixture_data)
                            session.add(fixture)
                            session.flush()  # Flush to get fixture in session before updating
                            fixture_created = True
                            
                            result.add_operation('fixture_create', {
                                'fixture_id': fixture_id,
                                'league': fixture_data.get('league', 'Unknown'),
                                'home_team': fixture_data.get('home_team', 'Unknown'),
                                'away_team': fixture_data.get('away_team', 'Unknown'),
                                'date': fixture_data.get('date', '').isoformat() if hasattr(fixture_data.get('date'), 'isoformat') else str(fixture_data.get('date', ''))
                            })
                            
                            logger.info(f"✅ Created new fixture {fixture_id}: {fixture_data.get('home_team')} vs {fixture_data.get('away_team')} ({fixture_data.get('league')})")
                        except Exception as e:
                            logger.error(f"❌ Error creating fixture {fixture_id}: {e}")
                            continue
                    else:
                        logger.warning(f"Fixture {fixture_id} not found and no full fixture data available, skipping")
                        continue
                
                # Track changes (for existing fixtures)
                old_status = fixture.status.value if fixture.status else None
                old_home_score = fixture.home_score
                old_away_score = fixture.away_score
                
                # Apply updates (for both new and existing fixtures)
                changes_made = False
                if 'status' in update and update['status'] != fixture.status:
                    fixture.status = update['status']
                    changes_made = True
                    
                if 'home_score' in update and update['home_score'] is not None and update['home_score'] != fixture.home_score:
                    fixture.home_score = update['home_score']
                    changes_made = True
                    
                if 'away_score' in update and update['away_score'] is not None and update['away_score'] != fixture.away_score:
                    fixture.away_score = update['away_score']
                    changes_made = True
                
                # Update timestamp if changes were made or fixture was created
                if changes_made or fixture_created:
                    fixture.last_updated = datetime.now(timezone.utc)
                    if not fixture_created:
                        result.fixtures_updated += 1
                        
                        result.add_operation('fixture_update', {
                            'fixture_id': fixture_id,
                            'old_status': old_status,
                            'new_status': fixture.status.value,
                            'old_home_score': old_home_score,
                            'new_home_score': fixture.home_score,
                            'old_away_score': old_away_score,
                            'new_away_score': fixture.away_score,
                            'match_name': f"{fixture.home_team} vs {fixture.away_team}"
                        })
                        
                        logger.info(f"Updated fixture {fixture_id}: {fixture.home_team} vs {fixture.away_team} - Status: {old_status} → {fixture.status.value}, Score: {old_home_score}-{old_away_score} → {fixture.home_score}-{fixture.away_score}")
                    else:
                        # Count creation as an update for reporting
                        result.fixtures_updated += 1
                        logger.info(f"✅ Created fixture {fixture_id}: {fixture.home_team} vs {fixture.away_team} - Status: {fixture.status.value}, Score: {fixture.home_score}-{fixture.away_score}")
            
            # Step 2: Lock predictions for matches that have started
            current_time = datetime.now(timezone.utc)
            
            # Get matches that have started but still have unlocked predictions
            matches_to_lock = session.query(Fixture).filter(
                Fixture.status != MatchStatus.NOT_STARTED,
                Fixture.date <= current_time
            ).all()
            
            for match in matches_to_lock:
                # Get submitted predictions that need locking
                submitted_predictions = session.query(UserPrediction).filter(
                    UserPrediction.fixture_id == match.fixture_id,
                    UserPrediction.prediction_status == PredictionStatus.SUBMITTED
                ).all()
                
                for prediction in submitted_predictions:
                    old_status = prediction.prediction_status.value
                    prediction.prediction_status = PredictionStatus.LOCKED
                    result.predictions_locked += 1
                    
                    result.add_operation('prediction_lock', {
                        'prediction_id': prediction.id,
                        'user_id': prediction.user_id,
                        'fixture_id': prediction.fixture_id,
                        'old_status': old_status,
                        'new_status': 'LOCKED'
                    })
                    
                    logger.info(f"Locked prediction {prediction.id} for user {prediction.user_id} on match {match.fixture_id}")
            
            # Step 3: Process completed matches
            completed_matches = session.query(Fixture).filter(
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ]),
                Fixture.home_score.isnot(None),
                Fixture.away_score.isnot(None)
            ).all()
            
            for match in completed_matches:
                # Get ALL predictions for this match (including previously processed ones)
                # This ensures we reprocess predictions if match status changed to FINISHED
                all_predictions = session.query(UserPrediction).filter(
                    UserPrediction.fixture_id == match.fixture_id
                ).all()
                
                for prediction in all_predictions:
                    # Only process if match is FINISHED and has valid scores
                    if match.status not in [MatchStatus.FINISHED, MatchStatus.FINISHED_AET, MatchStatus.FINISHED_PEN]:
                        continue
                    
                    if match.home_score is None or match.away_score is None:
                        logger.warning(f"Skipping prediction {prediction.id} for match {match.fixture_id} - scores not available")
                        continue
                    
                    old_status = prediction.prediction_status.value
                    old_points = prediction.points
                    
                    # Calculate points based on FINAL scores
                    points = calculate_points(
                        prediction.score1,
                        prediction.score2,
                        match.home_score,
                        match.away_score
                    )
                    
                    # Update prediction (reprocess even if previously processed to ensure accuracy)
                    prediction.points = points
                    prediction.prediction_status = PredictionStatus.PROCESSED
                    prediction.processed_at = datetime.now(timezone.utc)
                    
                    # Only count as "newly processed" if it wasn't already processed
                    if old_status != 'PROCESSED':
                        result.predictions_processed += 1
                    else:
                        # Log reprocessing for previously processed predictions
                        if old_points != points:
                            logger.info(f"🔄 Reprocessed prediction {prediction.id}: Points changed from {old_points} to {points}")
                    
                    result.add_operation('prediction_process', {
                        'prediction_id': prediction.id,
                        'user_id': prediction.user_id,
                        'fixture_id': prediction.fixture_id,
                        'predicted_score': f"{prediction.score1}-{prediction.score2}",
                        'actual_score': f"{match.home_score}-{match.away_score}",
                        'old_status': old_status,
                        'new_status': 'PROCESSED',
                        'old_points': old_points,
                        'new_points': points,
                        'was_reprocessed': old_status == 'PROCESSED'
                    })
                    
                    logger.info(f"Processed prediction {prediction.id}: {prediction.score1}-{prediction.score2} vs {match.home_score}-{match.away_score} = {points} points")
        
        return result
    
    def emergency_status_sync(self, fixture_id: int) -> TransactionResult:
        """
        Emergency function to sync a specific match's status and process all its predictions
        Only processes matches whose date has elapsed
        """
        with self.transaction_scope(f"emergency_sync_fixture_{fixture_id}") as (session, result):
            
            # Get the fixture
            fixture = session.query(Fixture).filter(
                Fixture.fixture_id == fixture_id
            ).first()
            
            if not fixture:
                raise ValueError(f"Fixture {fixture_id} not found")
            
            logger.info(f"Emergency sync for fixture {fixture_id}: {fixture.home_team} vs {fixture.away_team}")
            logger.info(f"Current status: {fixture.status.value}, Score: {fixture.home_score}-{fixture.away_score}")
            logger.info(f"Match date: {fixture.date}")
            
            # Check if match date has elapsed
            now = datetime.now(timezone.utc)

            # Handle timezone-aware vs timezone-naive comparison
            fixture_date = fixture.date
            if fixture_date.tzinfo is None:
                # If fixture date is naive, assume it's UTC
                fixture_date = fixture_date.replace(tzinfo=timezone.utc)

            if fixture_date > now:
                logger.info(f"⏭️ Skipping fixture {fixture_id}: match date {fixture_date} is in the future (current time: {now})")
                return result
            
            logger.info(f"✅ Match date has elapsed, proceeding with processing")
            
            # Get ALL predictions regardless of status
            all_predictions = session.query(UserPrediction).filter(
                UserPrediction.fixture_id == fixture_id
            ).all()
            
            if not all_predictions:
                logger.info(f"No predictions found for fixture {fixture_id}")
                return result
            
            logger.info(f"Found {len(all_predictions)} predictions for emergency processing")
            
            # Check if we have scores to calculate points
            if fixture.home_score is None or fixture.away_score is None:
                logger.warning(f"⚠️ Fixture {fixture_id} has no final scores, setting default scores for processing")
                # Match date has passed, set scores to 0-0 and mark as finished
                fixture.home_score = 0
                fixture.away_score = 0
                fixture.status = MatchStatus.FINISHED
                fixture.updated_at = datetime.now(timezone.utc)
                result.fixtures_updated = 1
                
                result.add_operation('emergency_fixture_completion', {
                    'fixture_id': fixture_id,
                    'old_status': fixture.status.value,
                    'new_status': 'FINISHED',
                    'set_score': '0-0',
                    'reason': 'Emergency processing - match date elapsed with no scores',
                    'match_name': f"{fixture.home_team} vs {fixture.away_team}",
                    'match_date': fixture.date.isoformat(),
                    'current_time': now.isoformat()
                })
                
                logger.info(f"Emergency: Set fixture {fixture_id} to FINISHED with 0-0 score (date elapsed)")
            
            # Only process predictions if match is FINISHED
            if fixture.status not in [MatchStatus.FINISHED, MatchStatus.FINISHED_AET, MatchStatus.FINISHED_PEN]:
                logger.warning(f"⚠️ Emergency sync: Fixture {fixture_id} is not FINISHED (status: {fixture.status.value}), skipping prediction processing")
                return result
            
            # Process ALL predictions (reprocess even if previously processed to ensure accuracy)
            for prediction in all_predictions:
                old_status = prediction.prediction_status.value
                old_points = prediction.points
                
                # Calculate points based on FINAL scores
                points = calculate_points(
                    prediction.score1,
                    prediction.score2,
                    fixture.home_score,
                    fixture.away_score
                )
                
                # Update prediction (reprocess to ensure accuracy)
                prediction.points = points
                prediction.prediction_status = PredictionStatus.PROCESSED
                prediction.processed_at = datetime.now(timezone.utc)
                
                # Only count as "newly processed" if it wasn't already processed
                if old_status != 'PROCESSED':
                    result.predictions_processed += 1
                else:
                    if old_points != points:
                        logger.info(f"🔄 Emergency: Reprocessed prediction {prediction.id}: Points changed from {old_points} to {points}")
                
                result.add_operation('emergency_prediction_process', {
                    'prediction_id': prediction.id,
                    'user_id': prediction.user_id,
                    'fixture_id': prediction.fixture_id,
                    'predicted_score': f"{prediction.score1}-{prediction.score2}",
                    'actual_score': f"{fixture.home_score}-{fixture.away_score}",
                    'old_status': old_status,
                    'new_status': 'PROCESSED',
                    'old_points': old_points,
                    'new_points': points,
                    'match_date': fixture.date.isoformat(),
                    'processed_at': datetime.now(timezone.utc).isoformat()
                })
                
                logger.info(f"Emergency processed prediction {prediction.id}: {prediction.score1}-{prediction.score2} vs {fixture.home_score}-{fixture.away_score} = {points} points")
        
        return result

# Global instance
unified_transaction_manager = UnifiedTransactionManager()