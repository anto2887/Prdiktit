# backend/scripts/update_match_statuses.py
#!/usr/bin/env python3
"""
Script to manually update match statuses from the API and process predictions
"""

import sys
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta

# Add backend to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.db.models import Fixture, MatchStatus, UserPrediction, PredictionStatus
from app.services.football_api import football_api_service
from app.services.match_processor import MatchProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def update_match_statuses():
    """Update match statuses from the API for recent matches"""
    db = SessionLocal()
    
    try:
        # Get matches from the last 7 days that might need status updates
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        
        matches_to_check = db.query(Fixture).filter(
            Fixture.date >= seven_days_ago,
            ~Fixture.status.in_([
                MatchStatus.FINISHED,
                MatchStatus.FINISHED_AET, 
                MatchStatus.FINISHED_PEN,
                MatchStatus.CANCELLED,
                MatchStatus.ABANDONED
            ])
        ).all()
        
        logger.info(f"🔍 Found {len(matches_to_check)} matches to check for status updates")
        
        updated_count = 0
        
        for match in matches_to_check:
            try:
                # Fetch latest data from API
                api_data = await football_api_service.make_api_request('fixtures', {
                    'id': match.fixture_id
                })
                
                if not api_data or len(api_data) == 0:
                    logger.warning(f"⚠️ No API data for fixture {match.fixture_id}")
                    continue
                
                fixture_data = api_data[0]
                
                # Extract status and scores
                api_status = fixture_data['fixture']['status']['short']
                status_map = {
                    'TBD': MatchStatus.NOT_STARTED,
                    'NS': MatchStatus.NOT_STARTED,
                    '1H': MatchStatus.FIRST_HALF,
                    'HT': MatchStatus.HALFTIME,
                    '2H': MatchStatus.SECOND_HALF,
                    'ET': MatchStatus.EXTRA_TIME,
                    'P': MatchStatus.PENALTY,
                    'FT': MatchStatus.FINISHED,
                    'AET': MatchStatus.FINISHED_AET,
                    'PEN': MatchStatus.FINISHED_PEN,
                    'LIVE': MatchStatus.LIVE,
                    'PST': MatchStatus.POSTPONED,
                    'CANC': MatchStatus.CANCELLED,
                    'AWD': MatchStatus.FINISHED  # Awarded - treat as finished
                }
                
                new_status = status_map.get(api_status, match.status)
                
                # Get scores
                goals = fixture_data.get('goals', {})
                new_home_score = goals.get('home')
                new_away_score = goals.get('away')
                
                # Check if anything changed
                status_changed = new_status != match.status
                scores_changed = (
                    (new_home_score is not None and new_home_score != match.home_score) or
                    (new_away_score is not None and new_away_score != match.away_score)
                )
                
                if status_changed or scores_changed:
                    logger.info(f"🔄 Updating fixture {match.fixture_id} ({match.home_team} vs {match.away_team})")
                    logger.info(f"   Status: {match.status} → {new_status}")
                    
                    # Update the match
                    match.status = new_status
                    if new_home_score is not None:
                        match.home_score = new_home_score
                    if new_away_score is not None:
                        match.away_score = new_away_score
                    
                    if scores_changed:
                        logger.info(f"   Score: {match.home_score}-{match.away_score}")
                    
                    updated_count += 1
                
                # Small delay to avoid rate limiting
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"❌ Error updating fixture {match.fixture_id}: {e}")
        
        # Commit all changes
        db.commit()
        logger.info(f"✅ Updated {updated_count} matches")
        
        return updated_count
        
    except Exception as e:
        logger.error(f"❌ Error in update_match_statuses: {e}")
        db.rollback()
        return 0
    finally:
        db.close()

async def process_missed_matches():
    """Process completed matches that were missed"""
    processor = MatchProcessor()
    
    try:
        # First update match statuses
        logger.info("🔄 Step 1: Updating match statuses from API...")
        updated_count = await update_match_statuses()
        
        # Then check for completed matches with predictions
        logger.info("🔄 Step 2: Looking for completed matches with predictions...")
        
        db = SessionLocal()
        try:
            # Find completed matches that have any predictions (SUBMITTED, LOCKED, or already PROCESSED)
            completed_matches = db.query(Fixture).filter(
                Fixture.status.in_([
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ]),
                Fixture.home_score.isnot(None),
                Fixture.away_score.isnot(None)
            ).all()
            
            matches_with_predictions = []
            
            for match in completed_matches:
                # Check if this match has any predictions that aren't PROCESSED
                unprocessed_predictions = db.query(UserPrediction).filter(
                    UserPrediction.fixture_id == match.fixture_id,
                    UserPrediction.prediction_status.in_([
                        PredictionStatus.SUBMITTED,
                        PredictionStatus.LOCKED,
                        PredictionStatus.EDITABLE  # Include EDITABLE for emergency processing
                    ])
                ).first()
                
                if unprocessed_predictions:
                    matches_with_predictions.append(match)
                    logger.info(f"📋 Found match needing processing: {match.home_team} vs {match.away_team} (Final: {match.home_score}-{match.away_score})")
            
            logger.info(f"📊 Found {len(matches_with_predictions)} matches with unprocessed predictions")
            
            # Process each match
            processed_count = 0
            total_predictions = 0
            
            for match in matches_with_predictions:
                try:
                    # Process this specific match
                    result = await process_single_match(match)
                    if result > 0:
                        processed_count += 1
                        total_predictions += result
                        logger.info(f"✅ Processed {result} predictions for {match.home_team} vs {match.away_team}")
                except Exception as e:
                    logger.error(f"❌ Error processing match {match.fixture_id}: {e}")
            
            logger.info(f"🎉 Processing complete: {processed_count} matches, {total_predictions} predictions processed")
            
        finally:
            db.close()
        
    except Exception as e:
        logger.error(f"❌ Error in process_missed_matches: {e}")

async def process_single_match(match):
    """Process predictions for a single completed match"""
    from app.db.repository import calculate_points
    
    db = SessionLocal()
    try:
        # Get all unprocessed predictions for this match
        predictions = db.query(UserPrediction).filter(
            UserPrediction.fixture_id == match.fixture_id,
            UserPrediction.prediction_status.in_([
                PredictionStatus.SUBMITTED,
                PredictionStatus.LOCKED,
                PredictionStatus.EDITABLE  # Emergency processing
            ])
        ).all()
        
        if not predictions:
            return 0
        
        processed_count = 0
        
        for prediction in predictions:
            try:
                # Calculate points
                points = calculate_points(
                    prediction.score1,  # home prediction
                    prediction.score2,  # away prediction  
                    match.home_score,   # actual home score
                    match.away_score    # actual away score
                )
                
                # Update prediction
                prediction.points = points
                prediction.prediction_status = PredictionStatus.PROCESSED
                
                processed_count += 1
                
                logger.debug(f"   🎯 Processed prediction {prediction.id}: {prediction.score1}-{prediction.score2} vs {match.home_score}-{match.away_score} = {points} points")
                
            except Exception as e:
                logger.error(f"❌ Error processing prediction {prediction.id}: {e}")
        
        db.commit()
        return processed_count
        
    except Exception as e:
        logger.error(f"❌ Error in process_single_match: {e}")
        db.rollback()
        return 0
    finally:
        db.close()

async def main():
    """Main function"""
    logger.info("🚀 Starting comprehensive match status update and processing...")
    
    try:
        await process_missed_matches()
        logger.info("🎉 All processing complete!")
        
    except Exception as e:
        logger.error(f"❌ Critical error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())