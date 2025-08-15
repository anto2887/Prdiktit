# backend/app/services/match_processor.py
"""
Updated Match Processor that uses the Unified Transaction Manager
All database operations now go through a single session with comprehensive logging
"""

import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from ..db.models import Fixture, MatchStatus
from .unified_transaction_manager import unified_transaction_manager, TransactionResult
from .match_status_updater import MatchStatusUpdater

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
        Main processing method - handles all match updates and prediction processing
        in a single unified transaction
        """
        try:
            logger.info("🔄 Starting comprehensive match processing cycle")
            audit_logger.info("PROCESSING_CYCLE_START: Comprehensive match processing")
            
            # Get fixture updates that need to be applied
            fixture_updates = self._prepare_fixture_updates()
            
            if not fixture_updates:
                logger.info("✅ No fixture updates needed")
                audit_logger.info("PROCESSING_CYCLE_COMPLETE: No updates needed")
                return {
                    "status": "success",
                    "fixtures_updated": 0,
                    "predictions_locked": 0,
                    "predictions_processed": 0,
                    "message": "No updates needed"
                }
            
            # Process all updates in a single transaction
            if fixture_updates:
                result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                    fixture_updates
                )
            else:
                # No fixture updates available, just process predictions
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
        """
        try:
            logger.info("🔄 Starting comprehensive match processing cycle (async)")
            audit_logger.info("PROCESSING_CYCLE_ASYNC_START: Comprehensive match processing")
            
            # Get fixture updates that need to be applied (async)
            fixture_updates = await self._prepare_fixture_updates_async()
            
            if not fixture_updates:
                logger.info("✅ No fixture updates needed (async)")
                audit_logger.info("PROCESSING_CYCLE_ASYNC_COMPLETE: No updates needed")
                return {
                    "status": "success",
                    "fixtures_updated": 0,
                    "predictions_locked": 0,
                    "predictions_processed": 0,
                    "message": "No updates needed"
                }
            
            # Process all updates in a single transaction
            if fixture_updates:
                result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                    fixture_updates
                )
            else:
                # No fixture updates available, just process predictions
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
    
    def _prepare_fixture_updates(self) -> List[Dict[str, Any]]:
        """
        Prepare fixture updates by fetching recent matches from the football API
        and comparing with current database state
        """
        try:
            logger.info("📡 Preparing fixture updates from API data...")
            audit_logger.info("FIXTURE_UPDATES_PREP_START: Fetching from API")
            
            # Create MatchStatusUpdater instance
            status_updater = MatchStatusUpdater()
            
            # Calculate date range for recent matches (last 7 days)
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=7)
            
            # Fetch matches from API using the existing service
            # Note: This is a sync method calling async, so we need to handle it properly
            try:
                # Try to get the event loop if we're in an async context
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # We're in an async context, can't run new event loop
                    logger.warning("⚠️ Cannot fetch API data in running async context, skipping fixture updates")
                    return []
            except RuntimeError:
                # No event loop running, we can create one
                pass
            
            # Fetch recent matches from API
            matches_data = asyncio.run(
                status_updater._fetch_matches_by_date_range(
                    start_date.strftime("%Y-%m-%d"),
                    end_date.strftime("%Y-%m-%d")
                )
            )
            
            if not matches_data:
                logger.info("📡 No match data received from API")
                return []
            
            logger.info(f"📡 Received {len(matches_data)} matches from API")
            
            # Convert API data to fixture updates using existing logic
            fixture_updates = status_updater._convert_api_data_to_updates(matches_data)
            
            if not fixture_updates:
                logger.info("📡 No fixture updates needed from API data")
                return []
            
            logger.info(f"📡 Prepared {len(fixture_updates)} fixture updates from API")
            audit_logger.info(f"FIXTURE_UPDATES_PREP_SUCCESS: {len(fixture_updates)} updates prepared")
            
            return fixture_updates
            
        except Exception as e:
            logger.error(f"❌ Error preparing fixture updates: {e}")
            audit_logger.error(f"FIXTURE_UPDATES_PREP_ERROR: {str(e)}")
            # Return empty list on error to prevent processing failure
            return []
    
    async def _prepare_fixture_updates_async(self) -> List[Dict[str, Any]]:
        """
        Async version of fixture updates preparation for use in async contexts
        """
        try:
            logger.info("📡 Preparing fixture updates from API data (async)...")
            audit_logger.info("FIXTURE_UPDATES_PREP_ASYNC_START: Fetching from API")
            
            # Create MatchStatusUpdater instance
            status_updater = MatchStatusUpdater()
            
            # Calculate date range for recent matches (last 7 days)
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=7)
            
            # Fetch matches from API using the existing service
            matches_data = await status_updater._fetch_matches_by_date_range(
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d")
            )
            
            if not matches_data:
                logger.info("📡 No match data received from API (async)")
                return []
            
            logger.info(f"📡 Received {len(matches_data)} matches from API (async)")
            
            # Convert API data to fixture updates using existing logic
            fixture_updates = status_updater._convert_api_data_to_updates(matches_data)
            
            if not fixture_updates:
                logger.info("📡 No fixture updates needed from API data (async)")
                return []
            
            logger.info(f"📡 Prepared {len(fixture_updates)} fixture updates from API (async)")
            audit_logger.info(f"FIXTURE_UPDATES_PREP_ASYNC_SUCCESS: {len(fixture_updates)} updates prepared")
            
            return fixture_updates
            
        except Exception as e:
            logger.error(f"❌ Error preparing fixture updates (async): {e}")
            audit_logger.error(f"FIXTURE_UPDATES_PREP_ASYNC_ERROR: {str(e)}")
            # Return empty list on error to prevent processing failure
            return []
    
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