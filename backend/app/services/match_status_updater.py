# backend/app/services/match_status_updater.py
"""
Updated Match Status Updater that uses the Unified Transaction Manager
Fetches data from API and delegates database operations to unified manager
"""

import aiohttp
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from ..core.config import settings
from ..db.models import MatchStatus
from .unified_transaction_manager import unified_transaction_manager

logger = logging.getLogger(__name__)

class MatchStatusUpdater:
    """
    Fetches match data from Football API and delegates database operations
    to the Unified Transaction Manager
    """
    
    def __init__(self):
        self.api_key = settings.FOOTBALL_API_KEY
        self.base_url = "https://api-football-v1.p.rapidapi.com/v3"
        self.headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
        
        logger.info("🚀 MatchStatusUpdater initialized - using UnifiedTransactionManager")
    
    async def update_recent_matches(self, days_back: int = 3) -> int:
        """
        Update recent matches from the last N days
        Returns number of matches updated
        """
        try:
            logger.info(f"🔄 Updating matches from last {days_back} days")
            
            # Calculate date range
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days_back)
            
            # Fetch match data from API
            matches_data = await self._fetch_matches_by_date_range(
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d")
            )
            
            if not matches_data:
                logger.info("No match data received from API")
                return 0
            
            # Convert API data to fixture updates
            fixture_updates = self._convert_api_data_to_updates(matches_data)
            
            if not fixture_updates:
                logger.info("No fixture updates needed")
                return 0
            
            # Use unified transaction manager to apply updates
            result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                fixture_updates
            )
            
            if result.success:
                logger.info(f"✅ Successfully updated {result.fixtures_updated} matches from API")
                return result.fixtures_updated
            else:
                logger.error(f"❌ Failed to update matches: {result.error_message}")
                return 0
                
        except Exception as e:
            logger.error(f"❌ Error updating recent matches: {e}")
            return 0
    
    async def update_live_matches(self) -> int:
        """
        Update currently live matches
        Returns number of matches updated
        """
        try:
            logger.info("🔴 Updating live matches")
            
            # Fetch live matches from API
            live_matches_data = await self._fetch_live_matches()
            
            if not live_matches_data:
                logger.info("No live matches data received from API")
                return 0
            
            # Convert API data to fixture updates
            fixture_updates = self._convert_api_data_to_updates(live_matches_data)
            
            if not fixture_updates:
                logger.info("No live match updates needed")
                return 0
            
            # Use unified transaction manager to apply updates
            result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                fixture_updates
            )
            
            if result.success:
                logger.info(f"✅ Successfully updated {result.fixtures_updated} live matches")
                return result.fixtures_updated
            else:
                logger.error(f"❌ Failed to update live matches: {result.error_message}")
                return 0
                
        except Exception as e:
            logger.error(f"❌ Error updating live matches: {e}")
            return 0
    
    async def update_specific_match(self, fixture_id: int) -> bool:
        """
        Update a specific match by fixture ID
        Returns True if successful
        """
        try:
            logger.info(f"🎯 Updating specific match: {fixture_id}")
            
            # Fetch specific match data from API
            match_data = await self._fetch_match_by_id(fixture_id)
            
            if not match_data:
                logger.warning(f"No data received for fixture {fixture_id}")
                return False
            
            # Convert API data to fixture updates
            fixture_updates = self._convert_api_data_to_updates([match_data])
            
            if not fixture_updates:
                logger.info(f"No updates needed for fixture {fixture_id}")
                return True
            
            # Use unified transaction manager to apply updates
            result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                fixture_updates
            )
            
            if result.success:
                logger.info(f"✅ Successfully updated fixture {fixture_id}")
                return True
            else:
                logger.error(f"❌ Failed to update fixture {fixture_id}: {result.error_message}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error updating fixture {fixture_id}: {e}")
            return False
    
    async def _fetch_matches_by_date_range(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """Fetch matches from API by date range"""
        try:
            async with aiohttp.ClientSession() as session:
                # MLS League ID is 253
                url = f"{self.base_url}/fixtures"
                params = {
                    "league": "253",
                    "season": "2025",
                    "from": start_date,
                    "to": end_date
                }
                
                async with session.get(url, headers=self.headers, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('response', [])
                    else:
                        logger.error(f"API request failed: {response.status}")
                        return []
                        
        except asyncio.TimeoutError:
            logger.error("API request timed out")
            return []
        except Exception as e:
            logger.error(f"Error fetching matches by date range: {e}")
            return []
    
    async def _fetch_live_matches(self) -> List[Dict[str, Any]]:
        """Fetch currently live matches from API"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/fixtures"
                params = {
                    "league": "253",
                    "season": "2025",
                    "live": "all"
                }
                
                async with session.get(url, headers=self.headers, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('response', [])
                    else:
                        logger.error(f"API request failed: {response.status}")
                        return []
                        
        except asyncio.TimeoutError:
            logger.error("API request timed out")
            return []
        except Exception as e:
            logger.error(f"Error fetching live matches: {e}")
            return []
    
    async def _fetch_match_by_id(self, fixture_id: int) -> Optional[Dict[str, Any]]:
        """Fetch specific match by ID from API"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/fixtures"
                params = {
                    "id": str(fixture_id)
                }
                
                async with session.get(url, headers=self.headers, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        fixtures = data.get('response', [])
                        return fixtures[0] if fixtures else None
                    else:
                        logger.error(f"API request failed: {response.status}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.error("API request timed out")
            return None
        except Exception as e:
            logger.error(f"Error fetching match {fixture_id}: {e}")
            return None
    
    def _convert_api_data_to_updates(self, matches_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert API response data to fixture update format
        """
        fixture_updates = []
        
        for match in matches_data:
            try:
                fixture_id = match['fixture']['id']
                api_status = match['fixture']['status']['short']
                
                # Convert API status to our MatchStatus enum
                match_status = self._convert_api_status_to_match_status(api_status)
                
                if not match_status:
                    continue  # Skip unsupported statuses
                
                # Extract scores
                home_score = match['goals']['home']
                away_score = match['goals']['away']
                
                # Create update object
                update = {
                    'fixture_id': fixture_id,
                    'status': match_status
                }
                
                # Add scores if they exist
                if home_score is not None:
                    update['home_score'] = home_score
                if away_score is not None:
                    update['away_score'] = away_score
                
                fixture_updates.append(update)
                
                logger.debug(f"Prepared update for fixture {fixture_id}: {api_status} -> {match_status.value}, "
                           f"Score: {home_score}-{away_score}")
                
            except Exception as e:
                logger.error(f"Error processing match data: {e}")
                continue
        
        logger.info(f"Prepared {len(fixture_updates)} fixture updates from API data")
        return fixture_updates
    
    def _convert_api_status_to_match_status(self, api_status: str) -> Optional[MatchStatus]:
        """Convert API status string to MatchStatus enum"""
        status_mapping = {
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
            'BT': MatchStatus.BREAK_TIME,
            'SUSP': MatchStatus.SUSPENDED,
            'INT': MatchStatus.INTERRUPTED,
            'PST': MatchStatus.POSTPONED,
            'CANC': MatchStatus.CANCELLED,
            'ABD': MatchStatus.ABANDONED,
            'AWD': MatchStatus.TECHNICAL_LOSS,
            'WO': MatchStatus.WALKOVER,
            'LIVE': MatchStatus.LIVE
        }
        
        return status_mapping.get(api_status)

# Global instance
match_status_updater = MatchStatusUpdater()