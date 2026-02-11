# backend/app/services/match_processor.py
"""
Updated Match Processor that uses the Unified Transaction Manager
All database operations now go through a single session with comprehensive logging
"""

import logging
from typing import Dict, Any, List
from ..db.models import Fixture
from .unified_transaction_manager import unified_transaction_manager

# Configure loggers
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('match_processing_audit')

class MatchProcessor:
    """
    Updated Match Processor that delegates all database operations to UnifiedTransactionManager
    No longer maintains its own database session
    """
    
    def __init__(self):
        # No longer creates its own database session
        logger.info("🚀 MatchProcessor initialized - using UnifiedTransactionManager")
        audit_logger.info("MATCH_PROCESSOR_INIT: Using unified transaction management")
    
    def process_all_matches(self) -> Dict[str, Any]:
        """
        Main processing method - processes predictions based on current database state
        
        Note: Fixture updates are handled by the scheduler via update_recent_matches().
        This method only processes predictions based on current database state.
        """
        try:
            logger.info("🔄 Starting prediction processing cycle")
            audit_logger.info("PROCESSING_CYCLE_START: Processing predictions from database")
            
            # Fixture updates are handled by the scheduler before this method is called
            # Just process predictions based on current database state
            result = unified_transaction_manager.process_all_predictions_without_updates()
            
            # Log final results
            if result.success:
                logger.info(f"✅ Processing complete: {result.fixtures_updated} fixtures updated, "
                           f"{result.predictions_locked} predictions locked, "
                           f"{result.predictions_processed} predictions processed")
                audit_logger.info(f"PROCESSING_CYCLE_SUCCESS: {result.to_dict()}")
                
                return {
                    "status": "success",
                    "fixtures_updated": result.fixtures_updated,
                    "predictions_locked": result.predictions_locked,
                    "predictions_processed": result.predictions_processed,
                    "verification_passed": result.verification_passed,
                    "operations_count": len(result.operations_log),
                    "message": "Processing completed successfully"
                }
            else:
                logger.error(f"❌ Processing failed: {result.error_message}")
                audit_logger.error(f"PROCESSING_CYCLE_FAILED: {result.to_dict()}")
                
                return {
                    "status": "error",
                    "error_message": result.error_message,
                    "rollback_reason": result.rollback_reason,
                    "operations_count": len(result.operations_log),
                    "message": f"Processing failed: {result.error_message}"
                }
                
        except Exception as e:
            logger.error(f"❌ Critical error in process_all_matches: {e}")
            audit_logger.error(f"PROCESSING_CYCLE_CRITICAL_ERROR: {str(e)}")
            return {
                "status": "critical_error", 
                "error_message": str(e),
                "message": f"Critical processing error: {str(e)}"
            }
    
    async def process_all_matches_async(self) -> Dict[str, Any]:
        """
        Async version of the main processing method for use in async contexts
        
        Note: Fixture updates are handled by the scheduler via update_recent_matches().
        This method only processes predictions based on current database state.
        """
        try:
            logger.info("🔄 Starting prediction processing cycle (async)")
            audit_logger.info("PROCESSING_CYCLE_ASYNC_START: Processing predictions from database")
            
            # Fixture updates are handled by the scheduler before this method is called
            # Just process predictions based on current database state
            result = unified_transaction_manager.process_all_predictions_without_updates()
            
            # Log final results
            if result.success:
                logger.info(f"✅ Processing complete (async): {result.fixtures_updated} fixtures updated, "
                           f"{result.predictions_locked} predictions locked, "
                           f"{result.predictions_processed} predictions processed")
                audit_logger.info(f"PROCESSING_CYCLE_ASYNC_SUCCESS: {result.to_dict()}")
                
                return {
                    "status": "success",
                    "fixtures_updated": result.fixtures_updated,
                    "predictions_locked": result.predictions_locked,
                    "predictions_processed": result.predictions_processed,
                    "verification_passed": result.verification_passed,
                    "operations_count": len(result.operations_log),
                    "message": "Processing completed successfully"
                }
            else:
                logger.error(f"❌ Processing failed (async): {result.error_message}")
                audit_logger.error(f"PROCESSING_CYCLE_ASYNC_FAILED: {result.to_dict()}")
                
                return {
                    "status": "error",
                    "error_message": result.error_message,
                    "rollback_reason": result.rollback_reason,
                    "operations_count": len(result.operations_log),
                    "message": f"Processing failed: {result.error_message}"
                }
                
        except Exception as e:
            logger.error(f"❌ Critical error in process_all_matches_async: {e}")
            audit_logger.error(f"PROCESSING_CYCLE_ASYNC_CRITICAL_ERROR: {str(e)}")
            return {
                "status": "critical_error", 
                "error_message": str(e),
                "message": f"Critical processing error: {str(e)}"
            }
    
    
    def emergency_process_match(self, fixture_id: int) -> Dict[str, Any]:
        """
        Emergency processing for a specific match
        """
        try:
            logger.info(f"🚨 Emergency processing for fixture {fixture_id}")
            audit_logger.info(f"EMERGENCY_PROCESSING_START: fixture_id={fixture_id}")
            
            result = unified_transaction_manager.emergency_status_sync(fixture_id)
            
            if result.success:
                logger.info(f"✅ Emergency processing complete for fixture {fixture_id}: "
                           f"{result.predictions_processed} predictions processed")
                audit_logger.info(f"EMERGENCY_PROCESSING_SUCCESS: fixture_id={fixture_id}, {result.to_dict()}")
                
                return {
                    "status": "success",
                    "fixture_id": fixture_id,
                    "predictions_processed": result.predictions_processed,
                    "verification_passed": result.verification_passed,
                    "message": f"Emergency processing completed for fixture {fixture_id}"
                }
            else:
                logger.error(f"❌ Emergency processing failed for fixture {fixture_id}: {result.error_message}")
                audit_logger.error(f"EMERGENCY_PROCESSING_FAILED: fixture_id={fixture_id}, {result.to_dict()}")
                
                return {
                    "status": "error",
                    "fixture_id": fixture_id,
                    "error_message": result.error_message,
                    "message": f"Emergency processing failed for fixture {fixture_id}: {result.error_message}"
                }
                
        except Exception as e:
            logger.error(f"❌ Critical error in emergency processing for fixture {fixture_id}: {e}")
            audit_logger.error(f"EMERGENCY_PROCESSING_CRITICAL_ERROR: fixture_id={fixture_id}, error={str(e)}")
            return {
                "status": "critical_error",
                "fixture_id": fixture_id,
                "error_message": str(e),
                "message": f"Critical error in emergency processing: {str(e)}"
            }
    
    # Legacy methods for backward compatibility - all delegate to unified transaction manager
    
    def get_completed_matches(self) -> List[Fixture]:
        """
        Legacy method - now just logs that it's deprecated
        """
        logger.warning("⚠️ get_completed_matches() is deprecated - use process_all_matches() instead")
        audit_logger.warning("DEPRECATED_METHOD_CALLED: get_completed_matches")
        return []
    
    def lock_predictions_for_match(self, fixture_id: int) -> int:
        """
        Legacy method - now just logs that it's deprecated
        """
        logger.warning("⚠️ lock_predictions_for_match() is deprecated - use process_all_matches() instead")
        audit_logger.warning(f"DEPRECATED_METHOD_CALLED: lock_predictions_for_match, fixture_id={fixture_id}")
        return 0
    
    def process_match_predictions(self, fixture: Fixture) -> int:
        """
        Legacy method - now just logs that it's deprecated
        """
        logger.warning("⚠️ process_match_predictions() is deprecated - use process_all_matches() instead")
        audit_logger.warning(f"DEPRECATED_METHOD_CALLED: process_match_predictions, fixture_id={fixture.fixture_id}")
        return 0