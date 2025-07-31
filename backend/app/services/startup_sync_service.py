# backend/app/services/startup_sync_service.py
"""
Comprehensive Startup Data Synchronization Service

This service runs on application startup and API refresh to:
1. Fetch latest fixture data from external API  
2. Process ALL predictions for finished matches (regardless of status)
3. Ensure comprehensive data consistency
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..db.models import Fixture, UserPrediction, MatchStatus, PredictionStatus
from ..db.repository import get_fixtures, create_or_update_fixture, calculate_points
from .football_api import football_api_service
from .match_processor import MatchProcessor

logger = logging.getLogger(__name__)
startup_logger = logging.getLogger('startup_sync')

class StartupSyncService:
    """Service to synchronize data and process scores on startup - STATUS AGNOSTIC"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.processor = None
        
        try:
            self.processor = MatchProcessor()
            logger.info("✅ Startup sync service initialized with MatchProcessor")
        except Exception as e:
            logger.error(f"❌ Failed to initialize MatchProcessor for startup: {e}")
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    async def run_startup_sync(self) -> Dict[str, Any]:
        """
        Main method to run complete startup synchronization
        STATUS AGNOSTIC: Processes ALL predictions for finished matches
        """
        start_time = datetime.now(timezone.utc)
        logger.info("🚀 Starting comprehensive startup data synchronization...")
        startup_logger.info(f"STARTUP_SYNC_BEGIN: timestamp={start_time.isoformat()}")
        
        results = {
            "status": "success", 
            "start_time": start_time.isoformat(),
            "fixtures_updated": 0,
            "fixtures_added": 0,
            "matches_processed": 0,
            "predictions_processed": 0,
            "errors": [],
            "duration_seconds": 0
        }
        
        try:
            # Step 1: Sync fixture data from API
            logger.info("📊 Step 1: Syncing fixture data from external API...")
            fixture_results = await self.sync_fixtures_from_api()
            results["fixtures_updated"] = fixture_results["updated"]
            results["fixtures_added"] = fixture_results["added"]
            
            # Step 2: STATUS AGNOSTIC - Process ALL predictions for finished matches
            logger.info("⚽ Step 2: Processing ALL predictions for finished matches (status agnostic)...")
            processing_results = await self.process_all_finished_matches()
            results["matches_processed"] = processing_results["matches_processed"]
            results["predictions_processed"] = processing_results["predictions_processed"]
            
            # Step 3: Verify prediction scoring consistency
            logger.info("🔍 Step 3: Verifying prediction scoring consistency...")
            verification_results = await self.verify_prediction_scoring()
            results["verification"] = verification_results
            
            end_time = datetime.now(timezone.utc)
            results["duration_seconds"] = (end_time - start_time).total_seconds()
            results["end_time"] = end_time.isoformat()
            
            logger.info(f"✅ Startup synchronization complete in {results['duration_seconds']:.2f}s")
            logger.info(f"   📊 Fixtures: {results['fixtures_added']} added, {results['fixtures_updated']} updated")
            logger.info(f"   ⚽ Processing: {results['matches_processed']} matches, {results['predictions_processed']} predictions")
            
            startup_logger.info(f"STARTUP_SYNC_COMPLETE: {results}")
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Startup synchronization failed: {e}")
            startup_logger.error(f"STARTUP_SYNC_ERROR: error='{str(e)}'")
            results["status"] = "error"
            results["error"] = str(e)
            return results
    
    async def sync_fixtures_from_api(self) -> Dict[str, int]:
        """
        Fetch latest fixture data from API and update database
        """
        results = {"added": 0, "updated": 0, "errors": 0}
        
        try:
            # Get date range for fixture sync (last 14 days + next 30 days for comprehensive coverage)
            start_date = datetime.now(timezone.utc) - timedelta(days=14)
            end_date = datetime.now(timezone.utc) + timedelta(days=30)
            
            logger.info(f"📅 Fetching fixtures from {start_date.date()} to {end_date.date()}")
            
            # Get current fixtures from database for comparison
            existing_fixtures = await get_fixtures(
                self.db,
                from_date=start_date,
                to_date=end_date
            )
            
            existing_fixture_ids = {f.fixture_id for f in existing_fixtures}
            
            # Fetch fixtures from API with correct parameter names
            try:
                api_fixtures = await football_api_service.get_fixtures_by_date_range(
                    from_date=start_date,
                    to_date=end_date
                )
                
                logger.info(f"📡 Retrieved {len(api_fixtures)} fixtures from API")
                
                for api_fixture in api_fixtures:
                    try:
                        fixture_id = api_fixture.get('fixture_id')
                        
                        if not fixture_id:
                            continue
                        
                        # Convert API data to our format
                        fixture_data = {
                            'fixture_id': fixture_id,
                            'home_team': api_fixture.get('home_team', ''),
                            'away_team': api_fixture.get('away_team', ''),
                            'date': api_fixture.get('date'),  # Already a datetime object
                            'league': api_fixture.get('league_name', ''),
                            'season': '2024-2025',  # Default season
                            'round': api_fixture.get('round', ''),
                            'status': MatchStatus(api_fixture.get('status', 'NOT_STARTED')),
                            'home_score': api_fixture.get('home_score'),
                            'away_score': api_fixture.get('away_score'),
                            'venue': api_fixture.get('venue'),
                            'referee': api_fixture.get('referee'),
                            'home_team_logo': api_fixture.get('home_team_logo'),
                            'away_team_logo': api_fixture.get('away_team_logo')
                        }
                        
                        # Create or update fixture
                        if fixture_id in existing_fixture_ids:
                            # Update existing fixture
                            existing_fixture = next(f for f in existing_fixtures if f.fixture_id == fixture_id)
                            updated = await self.update_fixture_if_changed(existing_fixture, fixture_data)
                            if updated:
                                results["updated"] += 1
                        else:
                            # Add new fixture
                            await create_or_update_fixture(self.db, **fixture_data)
                            results["added"] += 1
                        
                        # Small delay to respect rate limits
                        await asyncio.sleep(0.05)
                        
                    except Exception as e:
                        logger.error(f"❌ Error processing fixture {fixture_id}: {e}")
                        results["errors"] += 1
                        continue
                
            except Exception as e:
                logger.error(f"❌ Error fetching fixtures from API: {e}")
                # Continue with local processing even if API fails
                
        except Exception as e:
            logger.error(f"❌ Error in fixture sync: {e}")
            
        return results
    
    async def process_all_finished_matches(self) -> Dict[str, int]:
        """
        STATUS AGNOSTIC: Process ALL predictions for finished matches
        
        This method checks:
        1. Match is actually finished (has final scores and finished status)
        2. Processes ANY prediction regardless of current status
        3. Handles edge cases like draft predictions on completed matches
        """
        results = {"matches_processed": 0, "predictions_processed": 0}
        
        try:
            # Get ALL finished matches with final scores
            finished_matches = self.db.query(Fixture).filter(
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ]),
                Fixture.home_score.isnot(None),
                Fixture.away_score.isnot(None)
            ).all()
            
            logger.info(f"🔍 Found {len(finished_matches)} finished matches to check comprehensively")
            
            for match in finished_matches:
                try:
                    # STATUS AGNOSTIC: Get ALL predictions for this match (any status)
                    all_predictions = self.db.query(UserPrediction).filter(
                        UserPrediction.fixture_id == match.fixture_id
                    ).all()
                    
                    if not all_predictions:
                        continue
                    
                    # Filter to only predictions that need processing
                    predictions_to_process = []
                    already_processed_count = 0
                    
                    for prediction in all_predictions:
                        if prediction.prediction_status == PredictionStatus.PROCESSED:
                            already_processed_count += 1
                        else:
                            # ANY non-processed prediction gets processed
                            predictions_to_process.append(prediction)
                    
                    if not predictions_to_process:
                        if already_processed_count > 0:
                            logger.debug(f"✅ Match {match.fixture_id} already has {already_processed_count} processed predictions")
                        continue
                    
                    logger.info(f"⚽ Processing {len(predictions_to_process)} predictions for {match.home_team} vs {match.away_team}")
                    logger.info(f"   Final Score: {match.home_score}-{match.away_score}")
                    logger.info(f"   Match Date: {match.date}")
                    logger.info(f"   Already Processed: {already_processed_count}")
                    
                    # Process each prediction
                    processed_count = 0
                    points_distribution = {"3_points": 0, "1_point": 0, "0_points": 0}
                    
                    for prediction in predictions_to_process:
                        try:
                            old_status = prediction.prediction_status.value
                            
                            # Calculate points using the repository function
                            points = calculate_points(
                                prediction.score1,  # home prediction
                                prediction.score2,  # away prediction
                                match.home_score,   # actual home
                                match.away_score    # actual away
                            )
                            
                            # Update prediction regardless of original status
                            prediction.points = points
                            prediction.prediction_status = PredictionStatus.PROCESSED
                            prediction.processed_at = datetime.now(timezone.utc)
                            
                            processed_count += 1
                            
                            # Track distribution
                            if points == 3:
                                points_distribution["3_points"] += 1
                            elif points == 1:
                                points_distribution["1_point"] += 1
                            else:
                                points_distribution["0_points"] += 1
                            
                            logger.info(f"     User {prediction.user_id}: {prediction.score1}-{prediction.score2} → {points} pts (was {old_status})")
                            
                        except Exception as e:
                            logger.error(f"❌ Error processing prediction {prediction.id}: {e}")
                            continue
                    
                    if processed_count > 0:
                        self.db.commit()
                        results["matches_processed"] += 1
                        results["predictions_processed"] += processed_count
                        
                        logger.info(f"✅ Processed {processed_count} predictions for match {match.fixture_id}")
                        logger.info(f"📊 Points: {points_distribution['3_points']} perfect, {points_distribution['1_point']} correct, {points_distribution['0_points']} wrong")
                    
                except Exception as e:
                    logger.error(f"❌ Error processing match {match.fixture_id}: {e}")
                    self.db.rollback()
                    continue
                    
        except Exception as e:
            logger.error(f"❌ Error in process_all_finished_matches: {e}")
        
        return results
    
    async def update_fixture_if_changed(self, existing_fixture: Fixture, new_data: Dict) -> bool:
        """
        Update fixture only if data has actually changed
        """
        try:
            changes_made = False
            
            # Check for changes in key fields
            if existing_fixture.status != new_data['status']:
                old_status = existing_fixture.status.value
                existing_fixture.status = new_data['status']
                changes_made = True
                logger.info(f"📊 Status updated for {existing_fixture.home_team} vs {existing_fixture.away_team}: {old_status} → {new_data['status'].value}")
            
            if existing_fixture.home_score != new_data['home_score'] or existing_fixture.away_score != new_data['away_score']:
                old_score = f"{existing_fixture.home_score}-{existing_fixture.away_score}"
                existing_fixture.home_score = new_data['home_score']
                existing_fixture.away_score = new_data['away_score']
                changes_made = True
                new_score = f"{existing_fixture.home_score}-{existing_fixture.away_score}"
                logger.info(f"⚽ Score updated for {existing_fixture.home_team} vs {existing_fixture.away_team}: {old_score} → {new_score}")
            
            if changes_made:
                existing_fixture.last_updated = datetime.now(timezone.utc)
                self.db.commit()
                
            return changes_made
            
        except Exception as e:
            logger.error(f"❌ Error updating fixture: {e}")
            self.db.rollback()
            return False
    
    async def verify_prediction_scoring(self) -> Dict[str, int]:
        """
        Verify prediction scoring consistency and fix any issues
        """
        results = {"total_checked": 0, "inconsistencies_found": 0, "corrections_made": 0}
        
        try:
            # Check recent processed predictions for scoring consistency
            recent_processed = self.db.query(UserPrediction).join(Fixture).filter(
                UserPrediction.prediction_status == PredictionStatus.PROCESSED,
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ]),
                Fixture.date >= datetime.now(timezone.utc) - timedelta(days=14)
            ).limit(50).all()  # Check last 50 processed predictions
            
            for prediction in recent_processed:
                results["total_checked"] += 1
                
                # Recalculate expected points
                expected_points = calculate_points(
                    prediction.score1,
                    prediction.score2,
                    prediction.fixture.home_score,
                    prediction.fixture.away_score
                )
                
                if prediction.points != expected_points:
                    results["inconsistencies_found"] += 1
                    
                    # Fix the inconsistency
                    old_points = prediction.points
                    prediction.points = expected_points
                    results["corrections_made"] += 1
                    
                    logger.warning(f"🔧 Fixed scoring inconsistency for user {prediction.user_id} on match {prediction.fixture_id}: {old_points} → {expected_points} pts")
            
            if results["corrections_made"] > 0:
                self.db.commit()
                logger.info(f"✅ Fixed {results['corrections_made']} scoring inconsistencies")
            
        except Exception as e:
            logger.error(f"❌ Error in verify_prediction_scoring: {e}")
            self.db.rollback()
        
        return results

# Global instance
startup_sync_service = StartupSyncService()