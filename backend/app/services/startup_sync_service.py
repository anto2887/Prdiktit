# backend/app/services/startup_sync_service.py
"""
Startup Data Synchronization Service

This service runs on application startup to:
1. Fetch latest fixture data from external API
2. Update database with any new/changed fixtures
3. Process any missed score updates
4. Ensure all predictions are properly scored
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..db.models import Fixture, UserPrediction, MatchStatus, PredictionStatus
from ..db.repository import get_fixtures, create_or_update_fixture, process_match_predictions
from .football_api import football_api_service
from .match_processor import MatchProcessor

logger = logging.getLogger(__name__)
startup_logger = logging.getLogger('startup_sync')

class StartupSyncService:
    """Service to synchronize data and process scores on startup"""
    
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
        """
        start_time = datetime.now(timezone.utc)
        logger.info("🚀 Starting startup data synchronization...")
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
            
            # Step 2: Process any completed matches that weren't processed
            logger.info("⚽ Step 2: Processing completed matches...")
            processing_results = await self.process_completed_matches()
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
            logger.info(f"   Fixtures: {results['fixtures_added']} added, {results['fixtures_updated']} updated")
            logger.info(f"   Processing: {results['matches_processed']} matches, {results['predictions_processed']} predictions")
            
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
            # Get date range for fixture sync (last 7 days + next 30 days)
            start_date = datetime.now(timezone.utc) - timedelta(days=7)
            end_date = datetime.now(timezone.utc) + timedelta(days=30)
            
            logger.info(f"📅 Fetching fixtures from {start_date.date()} to {end_date.date()}")
            
            # Get current fixtures from database for comparison
            existing_fixtures = await get_fixtures(
                self.db,
                from_date=start_date,
                to_date=end_date
            )
            
            existing_fixture_ids = {f.fixture_id for f in existing_fixtures}
            
            # Fetch fixtures from API (you may need to adapt this based on your API)
            try:
                # Get fixtures by date range - adapt this to your football API service
                api_fixtures = await football_api_service.get_fixtures_by_date_range(
                    start_date=start_date.isoformat(),
                    end_date=end_date.isoformat()
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
                            'date': datetime.fromisoformat(api_fixture.get('date', '').replace('Z', '+00:00')),
                            'league': api_fixture.get('league', ''),
                            'season': api_fixture.get('season', '2024-2025'),
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
    
    async def update_fixture_if_changed(self, existing_fixture: Fixture, new_data: Dict) -> bool:
        """
        Update fixture only if data has actually changed
        """
        try:
            changes_made = False
            
            # Check for changes in key fields
            if existing_fixture.status != new_data['status']:
                existing_fixture.status = new_data['status']
                changes_made = True
                logger.info(f"📊 Status updated for {existing_fixture.home_team} vs {existing_fixture.away_team}: {existing_fixture.status.value} → {new_data['status'].value}")
            
            if existing_fixture.date != new_data['date']:
                existing_fixture.date = new_data['date']
                changes_made = True
                logger.info(f"📅 Date updated for {existing_fixture.home_team} vs {existing_fixture.away_team}")
            
            if (existing_fixture.home_score != new_data['home_score'] or 
                existing_fixture.away_score != new_data['away_score']):
                existing_fixture.home_score = new_data['home_score']
                existing_fixture.away_score = new_data['away_score']
                changes_made = True
                logger.info(f"⚽ Score updated for {existing_fixture.home_team} vs {existing_fixture.away_team}: {new_data['home_score']}-{new_data['away_score']}")
            
            if existing_fixture.venue != new_data.get('venue'):
                existing_fixture.venue = new_data.get('venue')
                changes_made = True
            
            if changes_made:
                existing_fixture.updated_at = datetime.now(timezone.utc)
                self.db.commit()
                
            return changes_made
            
        except Exception as e:
            logger.error(f"❌ Error updating fixture {existing_fixture.fixture_id}: {e}")
            self.db.rollback()
            return False
    
    async def process_completed_matches(self) -> Dict[str, int]:
        """
        Process all completed matches that haven't been processed yet
        """
        results = {"matches_processed": 0, "predictions_processed": 0}
        
        try:
            # Find completed matches that haven't been processed
            completed_matches = self.db.query(Fixture).filter(
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ]),
                Fixture.home_score.isnot(None),
                Fixture.away_score.isnot(None)
            ).all()
            
            logger.info(f"🔍 Found {len(completed_matches)} completed matches to check")
            
            for match in completed_matches:
                try:
                    # Check if there are unprocessed predictions for this match
                    unprocessed_predictions = self.db.query(UserPrediction).filter(
                        UserPrediction.fixture_id == match.fixture_id,
                        UserPrediction.prediction_status.in_([
                            PredictionStatus.SUBMITTED,
                            PredictionStatus.LOCKED
                        ])
                    ).count()
                    
                    if unprocessed_predictions > 0:
                        logger.info(f"⚽ Processing {unprocessed_predictions} predictions for {match.home_team} vs {match.away_team}")
                        
                        # Process predictions for this match
                        if self.processor:
                            processed_count = self.processor.process_match_predictions(match)
                            results["predictions_processed"] += processed_count
                            results["matches_processed"] += 1
                        else:
                            # Fallback to repository function
                            processed_count = await process_match_predictions(self.db, match.fixture_id)
                            results["predictions_processed"] += processed_count
                            results["matches_processed"] += 1
                            
                except Exception as e:
                    logger.error(f"❌ Error processing match {match.fixture_id}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"❌ Error in completed matches processing: {e}")
            
        return results
    
    async def verify_prediction_scoring(self) -> Dict[str, Any]:
        """
        Verify that all processed predictions have correct scores
        """
        verification_results = {
            "total_checked": 0,
            "inconsistencies_found": 0,
            "corrections_made": 0
        }
        
        try:
            # Get all processed predictions from the last 30 days
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
            
            processed_predictions = self.db.query(UserPrediction).join(
                Fixture, UserPrediction.fixture_id == Fixture.fixture_id
            ).filter(
                UserPrediction.prediction_status == PredictionStatus.PROCESSED,
                Fixture.date >= cutoff_date,
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ])
            ).all()
            
            verification_results["total_checked"] = len(processed_predictions)
            
            for prediction in processed_predictions:
                fixture = prediction.fixture
                
                # Recalculate points
                from ..db.repository import calculate_points
                correct_points = calculate_points(
                    prediction.score1,
                    prediction.score2,
                    fixture.home_score,
                    fixture.away_score
                )
                
                # Check if points are incorrect
                if prediction.points != correct_points:
                    logger.warning(f"🔧 Correcting points for prediction {prediction.id}: {prediction.points} → {correct_points}")
                    prediction.points = correct_points
                    verification_results["inconsistencies_found"] += 1
                    verification_results["corrections_made"] += 1
            
            if verification_results["corrections_made"] > 0:
                self.db.commit()
                logger.info(f"✅ Corrected {verification_results['corrections_made']} prediction scoring inconsistencies")
            
        except Exception as e:
            logger.error(f"❌ Error in prediction scoring verification: {e}")
            self.db.rollback()
            
        return verification_results

# Global instance
startup_sync_service = StartupSyncService()