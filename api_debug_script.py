# backend/app/services/match_status_updater.py
"""
Match Status Updater with proper async context handling
"""

import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.db.database import SessionLocal
from backend.app.db.models import Fixture, MatchStatus
from backend.app.services.football_api import football_api_service

logger = logging.getLogger(__name__)

class MatchStatusUpdater:
    """Service to update match statuses from the football API"""
    
    def __init__(self):
        self.db = SessionLocal()
        
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    async def update_recent_matches(self, days_back: int = 3) -> int:
        """
        Update status for matches from the last few days
        
        Args:
            days_back: How many days back to check for matches
            
        Returns:
            Number of matches updated
        """
        try:
            # Ensure we're in an async context
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.error("❌ update_recent_matches called outside async context")
                return 0
            
            # Get matches from the last few days that might need updates
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
            
            matches_to_check = self.db.query(Fixture).filter(
                Fixture.date >= cutoff_date,
                ~Fixture.status.in_([
                    MatchStatus.CANCELLED,
                    MatchStatus.ABANDONED
                ])
            ).all()
            
            logger.info(f"🔍 Checking {len(matches_to_check)} recent matches for status updates")
            
            updated_count = 0
            
            for match in matches_to_check:
                try:
                    # Fetch latest data from API - this is now properly async
                    fixture_data = await football_api_service.get_fixture_by_id(match.fixture_id)
                    
                    if not fixture_data:
                        continue
                    
                    # Extract new status and scores
                    new_status_str = fixture_data.get('status', 'NOT_STARTED')
                    
                    # Map string status to enum
                    try:
                        new_status = MatchStatus(new_status_str)
                    except ValueError:
                        logger.warning(f"⚠️ Unknown status '{new_status_str}' for fixture {match.fixture_id}")
                        continue
                    
                    # Get current scores
                    new_home_score = fixture_data.get('home_score')
                    new_away_score = fixture_data.get('away_score')
                    
                    # Check if anything changed
                    status_changed = new_status != match.status
                    scores_changed = (
                        (new_home_score is not None and new_home_score != match.home_score) or
                        (new_away_score is not None and new_away_score != match.away_score)
                    )
                    
                    if status_changed or scores_changed:
                        logger.info(f"🔄 Updating fixture {match.fixture_id} ({match.home_team} vs {match.away_team})")
                        
                        if status_changed:
                            logger.info(f"   Status: {match.status.value} → {new_status.value}")
                            match.status = new_status
                        
                        if scores_changed:
                            old_score = f"{match.home_score}-{match.away_score}"
                            if new_home_score is not None:
                                match.home_score = new_home_score
                            if new_away_score is not None:
                                match.away_score = new_away_score
                            new_score = f"{match.home_score}-{match.away_score}"
                            logger.info(f"   Score: {old_score} → {new_score}")
                        
                        match.last_updated = datetime.now(timezone.utc)
                        updated_count += 1
                    
                    # Small delay to respect rate limits
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"❌ Error updating fixture {match.fixture_id}: {e}")
            
            # Commit all changes
            self.db.commit()
            logger.info(f"✅ Updated {updated_count} matches from API")
            
            return updated_count
            
        except Exception as e:
            logger.error(f"❌ Error in update_recent_matches: {e}")
            self.db.rollback()
            return 0
    
    async def update_live_matches(self) -> int:
        """Update status for currently live matches"""
        try:
            # Ensure we're in an async context
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.error("❌ update_live_matches called outside async context")
                return 0
            
            # Get matches that might be live
            live_statuses = [
                MatchStatus.FIRST_HALF,
                MatchStatus.HALFTIME,
                MatchStatus.SECOND_HALF,
                MatchStatus.EXTRA_TIME,
                MatchStatus.PENALTY,
                MatchStatus.LIVE
            ]
            
            live_matches = self.db.query(Fixture).filter(
                Fixture.status.in_(live_statuses)
            ).all()
            
            logger.info(f"🔴 Checking {len(live_matches)} potentially live matches")
            
            updated_count = 0
            
            for match in live_matches:
                try:
                    fixture_data = await football_api_service.get_fixture_by_id(match.fixture_id)
                    
                    if fixture_data:
                        # Extract new status
                        new_status_str = fixture_data.get('status', match.status.value)
                        
                        try:
                            new_status = MatchStatus(new_status_str)
                        except ValueError:
                            logger.warning(f"⚠️ Unknown status '{new_status_str}' for live fixture {match.fixture_id}")
                            continue
                        
                        # Get current scores
                        new_home_score = fixture_data.get('home_score', 0)
                        new_away_score = fixture_data.get('away_score', 0)
                        
                        # Update if changed
                        if (new_status != match.status or 
                            new_home_score != match.home_score or 
                            new_away_score != match.away_score):
                            
                            logger.info(f"🔄 Live update: {match.home_team} vs {match.away_team}")
                            logger.info(f"   Status: {match.status.value} → {new_status.value}")
                            logger.info(f"   Score: {match.home_score}-{match.away_score} → {new_home_score}-{new_away_score}")
                            
                            match.status = new_status
                            match.home_score = new_home_score
                            match.away_score = new_away_score
                            match.last_updated = datetime.now(timezone.utc)
                            
                            updated_count += 1
                    
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"❌ Error updating live match {match.fixture_id}: {e}")
            
            self.db.commit()
            if updated_count > 0:
                logger.info(f"✅ Updated {updated_count} live matches")
            
            return updated_count
            
        except Exception as e:
            logger.error(f"❌ Error in update_live_matches: {e}")
            self.db.rollback()
            return 0
    
    def update_recent_matches_sync(self, days_back: int = 3) -> int:
        """
        Synchronous version for when async context is not available
        
        Args:
            days_back: How many days back to check for matches
            
        Returns:
            Number of matches that would be updated (just count, no API calls)
        """
        try:
            # Get matches from the last few days that might need updates
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
            
            matches_to_check = self.db.query(Fixture).filter(
                Fixture.date >= cutoff_date,
                ~Fixture.status.in_([
                    MatchStatus.CANCELLED,
                    MatchStatus.ABANDONED,
                    MatchStatus.FINISHED,
                    MatchStatus.FINISHED_AET,
                    MatchStatus.FINISHED_PEN
                ])
            ).all()
            
            logger.info(f"🔍 Found {len(matches_to_check)} recent matches that could be updated (sync mode)")
            
            return len(matches_to_check)
            
        except Exception as e:
            logger.error(f"❌ Error in update_recent_matches_sync: {e}")
            return 0

# Create global instance  
match_status_updater = MatchStatusUpdater()