# backend/app/services/match_status_updater.py
"""
Updated Match Status Updater that uses the Unified Transaction Manager
Fetches data from API and delegates database operations to unified manager
Supports multi-league updates with parallel requests and API expiration handling
"""

import aiohttp
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple

from ..core.config import settings
from ..db.models import MatchStatus
from ..utils.season_manager import SeasonManager
from .unified_transaction_manager import unified_transaction_manager

logger = logging.getLogger(__name__)

class MatchStatusUpdater:
    """
    Fetches match data from Football API and delegates database operations
    to the Unified Transaction Manager
    """
    
    def __init__(self):
        self.api_key = settings.FOOTBALL_API_KEY
        # Updated to use API-Sports directly instead of RapidAPI
        self.base_url = "https://v3.football.api-sports.io"
        self.headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": "v3.football.api-sports.io"
        }
        
        # Rate limiting tracking
        self.last_api_call = None
        self.rate_limit_hit = False
        self.rate_limit_reset_time = None
        self.rate_limit_delay = 0.5  # 500ms between requests (matching FootballAPIService)
        
        # API health state tracking
        self.api_subscription_active = True
        self.api_last_successful_call = None
        self.api_consecutive_failures = 0
        self.api_subscription_expired_at = None
        self.api_health_check_interval = timedelta(hours=6)
        self.last_health_check = None
        
        logger.info("🚀 MatchStatusUpdater initialized - using UnifiedTransactionManager")
        logger.info("📊 Multi-league support enabled with parallel requests")
        
        # Validate API key on startup
        if not self._validate_api_key():
            logger.error("❌ CRITICAL: Invalid API key configuration detected!")
            logger.error("❌ Please check your FOOTBALL_API_KEY environment variable")
            self.api_subscription_active = False
        else:
            logger.info("✅ API key validation passed")
    
    def _should_skip_api_call(self) -> bool:
        """
        Check if we should skip API calls due to rate limiting
        """
        if not self.rate_limit_hit:
            return False
        
        if self.rate_limit_reset_time and datetime.now(timezone.utc) < self.rate_limit_reset_time:
            logger.info("⏳ Rate limit still active, skipping API call")
            return True
        
        # Reset rate limit flag if time has passed
        self.rate_limit_hit = False
        self.rate_limit_reset_time = None
        logger.info("✅ Rate limit reset, resuming API calls")
        return False
    
    def _validate_api_key(self) -> bool:
        """
        Validate that the API key is properly configured
        """
        if not self.api_key or self.api_key == "your_api_key_here":
            logger.error("❌ Invalid API key configuration")
            return False
        return True
    
    async def update_recent_matches(
        self,
        days_back: int = 3,
        days_forward: int = 14,
        process_predictions: bool = True
    ) -> int:
        """
        Update matches from the last N days and next M days for all configured leagues
        This fetches both past matches (for status updates) and future matches (for predictions)
        
        Args:
            days_back: Number of days in the past to fetch (default: 3)
            days_forward: Number of days in the future to fetch (default: 14)
        
        Returns:
            Number of matches updated across all leagues
        """
        try:
            logger.info(
                f"🔄 Updating matches from {days_back} days ago to {days_forward} days ahead for all leagues"
            )
            
            # Check API subscription status
            if not self.api_subscription_active:
                logger.warning("⏭️ Skipping API calls - subscription expired or inactive")
                return 0
            
            # Check API key validity
            if not self._validate_api_key():
                logger.error("⏭️ Skipping API call due to invalid API key")
                return 0
            
            # Check rate limiting
            if self._should_skip_api_call():
                logger.info("⏭️ Skipping API call due to rate limiting")
                return 0
            
            # Calculate date range (past to future)
            now = datetime.now(timezone.utc)
            start_date = now - timedelta(days=days_back)
            end_date = now + timedelta(days=days_forward)
            start_date_str = start_date.strftime("%Y-%m-%d")
            end_date_str = end_date.strftime("%Y-%m-%d")
            
            logger.info(f"📅 Date range: {start_date_str} to {end_date_str} (now: {now.strftime('%Y-%m-%d %H:%M:%S UTC')})")
            logger.info(f"   - Looking back: {days_back} days")
            logger.info(f"   - Looking forward: {days_forward} days")
            
            # Get all configured leagues
            leagues = self._get_configured_leagues()
            if not leagues:
                logger.warning("⚠️ No configured leagues found")
                return 0
            
            logger.info(f"📊 Fetching matches for {len(leagues)} leagues: {[l['league_name'] for l in leagues]}")
            
            # Fetch matches for all leagues in parallel with rate limiting
            all_matches_data = await self._fetch_matches_for_all_leagues_parallel(
                leagues, start_date_str, end_date_str
            )
            
            if not all_matches_data:
                logger.info("No match data received from API for any league")
                return 0
            
            logger.info(f"📥 Received {len(all_matches_data)} fixtures from API")
            
            # Convert API data to fixture updates
            # Pass league configs for season determination
            fixture_updates = self._convert_api_data_to_updates(all_matches_data, leagues)
            
            if not fixture_updates:
                logger.info("No fixture updates needed")
                return 0
            
            # Use unified transaction manager to apply updates
            result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                fixture_updates,
                process_predictions=process_predictions
            )
            
            if result.success:
                logger.info(f"✅ Successfully updated {result.fixtures_updated} matches from API across all leagues")
                return result.fixtures_updated
            else:
                logger.error(f"❌ Failed to update matches: {result.error_message}")
                return 0
                
        except Exception as e:
            logger.error(f"❌ Error updating recent matches: {e}")
            return 0
    
    async def update_live_matches(self, process_predictions: bool = True) -> int:
        """
        Update currently live matches for all configured leagues
        Returns number of matches updated across all leagues
        """
        try:
            logger.info("🔴 Updating live matches for all leagues")
            
            # Check API subscription status
            if not self.api_subscription_active:
                logger.warning("⏭️ Skipping live matches API calls - subscription expired or inactive")
                return 0
            
            # Check API key validity
            if not self._validate_api_key():
                logger.error("⏭️ Skipping live matches API call due to invalid API key")
                return 0
            
            # Check rate limiting
            if self._should_skip_api_call():
                logger.info("⏭️ Skipping live matches API call due to rate limiting")
                return 0
            
            # Get all configured leagues
            leagues = self._get_configured_leagues()
            if not leagues:
                logger.warning("⚠️ No configured leagues found")
                return 0
            
            logger.info(f"📊 Fetching live matches for {len(leagues)} leagues")
            
            # Fetch live matches for all leagues in parallel with rate limiting
            all_live_matches_data = await self._fetch_live_matches_for_all_leagues_parallel(leagues)
            
            if not all_live_matches_data:
                logger.info("No live matches data received from API for any league")
                return 0
            
            logger.info(f"📥 Received {len(all_live_matches_data)} live fixtures from API")
            
            # Convert API data to fixture updates with league context
            fixture_updates = self._convert_api_data_to_updates(all_live_matches_data, leagues)
            
            if not fixture_updates:
                logger.info("No live match updates needed")
                return 0
            
            # Use unified transaction manager to apply updates
            result = unified_transaction_manager.update_match_statuses_and_process_predictions(
                fixture_updates,
                process_predictions=process_predictions
            )
            
            if result.success:
                logger.info(f"✅ Successfully updated {result.fixtures_updated} live matches across all leagues")
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
            
            # Check API key validity
            if not self._validate_api_key():
                logger.error(f"⏭️ Skipping specific match update due to invalid API key")
                return False
            
            # Fetch specific match data from API
            match_data = await self._fetch_match_by_id(fixture_id)
            
            if not match_data:
                logger.warning(f"No data received for fixture {fixture_id}")
                return False
            
            # Convert API data to fixture updates
            # Get league configs for season determination
            leagues = self._get_configured_leagues()
            fixture_updates = self._convert_api_data_to_updates([match_data], leagues)
            
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
    
    async def _fetch_matches_by_date_range(self, start_date: str, end_date: str, league_id: int, season: int) -> List[Dict[str, Any]]:
        """
        Fetch matches from API by date range for a specific league
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            league_id: API league ID
            season: Season year
        Returns:
            List of match data dictionaries
        """
        try:
            # Apply rate limiting delay
            await self._apply_rate_limit_delay()
            
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/fixtures"
                params = {
                    "league": str(league_id),
                    "season": str(season),
                    "from": start_date,
                    "to": end_date
                }
                
                async with session.get(url, headers=self.headers, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        matches = data.get('response', [])
                        
                        # Update API health state on success
                        self.api_subscription_active = True
                        self.api_consecutive_failures = 0
                        self.api_last_successful_call = datetime.now(timezone.utc)
                        if self.api_subscription_expired_at:
                            logger.info("✅ API subscription appears to be restored")
                            self.api_subscription_expired_at = None
                        
                        return matches
                    elif response.status == 429:
                        logger.warning("⚠️ API rate limit exceeded (429), setting rate limit flag")
                        self.rate_limit_hit = True
                        # Set reset time to 1 minute from now
                        self.rate_limit_reset_time = datetime.now(timezone.utc) + timedelta(minutes=1)
                        return []
                    elif response.status == 403:
                        logger.error("❌ API access forbidden (403) - subscription expired or invalid API key")
                        # Update API health state on 403
                        self.api_subscription_active = False
                        self.api_consecutive_failures += 1
                        if not self.api_subscription_expired_at:
                            self.api_subscription_expired_at = datetime.now(timezone.utc)
                            logger.error(f"❌ CRITICAL: API subscription expired at {self.api_subscription_expired_at.isoformat()}")
                        return []
                    else:
                        logger.error(f"API request failed: {response.status}")
                        self.api_consecutive_failures += 1
                        return []
                        
        except asyncio.TimeoutError:
            logger.error("API request timed out")
            self.api_consecutive_failures += 1
            return []
        except Exception as e:
            logger.error(f"Error fetching matches by date range: {e}")
            self.api_consecutive_failures += 1
            return []
    
    async def _fetch_live_matches(self, league_id: int, season: int) -> List[Dict[str, Any]]:
        """
        Fetch currently live matches from API for a specific league
        Args:
            league_id: API league ID
            season: Season year
        Returns:
            List of live match data dictionaries
        """
        try:
            # Apply rate limiting delay
            await self._apply_rate_limit_delay()
            
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/fixtures"
                params = {
                    "league": str(league_id),
                    "season": str(season),
                    "live": "all"
                }
                
                async with session.get(url, headers=self.headers, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        matches = data.get('response', [])
                        
                        # Update API health state on success
                        self.api_subscription_active = True
                        self.api_consecutive_failures = 0
                        self.api_last_successful_call = datetime.now(timezone.utc)
                        if self.api_subscription_expired_at:
                            logger.info("✅ API subscription appears to be restored")
                            self.api_subscription_expired_at = None
                        
                        return matches
                    elif response.status == 429:
                        logger.warning("⚠️ API rate limit exceeded (429), setting rate limit flag")
                        self.rate_limit_hit = True
                        # Set reset time to 1 minute from now
                        self.rate_limit_reset_time = datetime.now(timezone.utc) + timedelta(minutes=1)
                        return []
                    elif response.status == 403:
                        logger.error("❌ API access forbidden (403) - subscription expired or invalid API key")
                        # Update API health state on 403
                        self.api_subscription_active = False
                        self.api_consecutive_failures += 1
                        if not self.api_subscription_expired_at:
                            self.api_subscription_expired_at = datetime.now(timezone.utc)
                            logger.error(f"❌ CRITICAL: API subscription expired at {self.api_subscription_expired_at.isoformat()}")
                        return []
                    else:
                        logger.error(f"API request failed: {response.status}")
                        self.api_consecutive_failures += 1
                        return []
                        
        except asyncio.TimeoutError:
            logger.error("API request timed out")
            self.api_consecutive_failures += 1
            return []
        except Exception as e:
            logger.error(f"Error fetching live matches: {e}")
            self.api_consecutive_failures += 1
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
                    elif response.status == 429:
                        logger.warning("⚠️ API rate limit exceeded (429), setting rate limit flag")
                        self.rate_limit_hit = True
                        # Set reset time to 1 minute from now
                        self.rate_limit_reset_time = datetime.now(timezone.utc) + timedelta(minutes=1)
                        return None
                    elif response.status == 403:
                        logger.error("❌ API access forbidden (403) - subscription expired or invalid API key")
                        # Update API health state on 403
                        self.api_subscription_active = False
                        self.api_consecutive_failures += 1
                        if not self.api_subscription_expired_at:
                            self.api_subscription_expired_at = datetime.now(timezone.utc)
                            logger.error(f"❌ CRITICAL: API subscription expired at {self.api_subscription_expired_at.isoformat()}")
                        return None
                    else:
                        logger.error(f"API request failed: {response.status}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.error("API request timed out")
            return None
        except Exception as e:
            logger.error(f"Error fetching match {fixture_id}: {e}")
            return None
    
    def _convert_api_data_to_updates(self, matches_data: List[Dict[str, Any]], leagues: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """
        Convert API response data to fixture update format with full fixture data
        This allows creating missing fixtures if they don't exist in the database
        
        Args:
            matches_data: List of match data from API
            leagues: Optional list of league configs for season determination
        """
        fixture_updates = []
        
        # Create a map of competition_id -> league config for quick lookup
        league_map = {}
        if leagues:
            for league_config in leagues:
                league_map[league_config['api_id']] = league_config
        
        for match in matches_data:
            try:
                fixture_id = match['fixture']['id']
                api_status = match['fixture']['status']['short']
                
                # Convert API status to our MatchStatus enum
                match_status = self._convert_api_status_to_match_status(api_status)
                
                if not match_status:
                    continue  # Skip unsupported statuses
                
                # Extract scores
                goals = match.get('goals', {})
                home_score = goals.get('home')
                away_score = goals.get('away')
                
                # Extract full fixture data for creation if needed
                fixture_info = match['fixture']
                teams = match['teams']
                league_info = match['league']
                competition_id = league_info.get('id')
                
                # Parse date first (needed for both season determination and fixture creation)
                date_str = fixture_info.get('date', '')
                if date_str:
                    # Handle timezone format
                    if date_str.endswith('Z'):
                        date_str = date_str[:-1] + '+00:00'
                    try:
                        fixture_datetime = datetime.fromisoformat(date_str)
                    except ValueError:
                        logger.warning(f"Invalid date format for fixture {fixture_id}: {date_str}")
                        fixture_datetime = datetime.now(timezone.utc)
                else:
                    fixture_datetime = datetime.now(timezone.utc)
                
                # Get league name and season from league config if available
                league_name = league_info.get('name', 'Unknown League')
                season = None
                
                if competition_id and competition_id in league_map:
                    league_config = league_map[competition_id]
                    league_name = league_config['league_name']
                    season = str(league_config['db_season'])
                else:
                    # Fallback: use SeasonManager to determine season based on league name and date
                    try:
                        season = SeasonManager.get_current_season(league_name)
                    except:
                        # Ultimate fallback: use year from fixture date
                        season = str(fixture_datetime.year)
                
                # Create update object with full fixture data
                update = {
                    'fixture_id': fixture_id,
                    'status': match_status,
                    # Full fixture data for creation
                    'full_fixture_data': {
                        'fixture_id': fixture_id,
                        'home_team': teams['home']['name'],
                        'away_team': teams['away']['name'],
                        'home_team_logo': teams['home'].get('logo'),
                        'away_team_logo': teams['away'].get('logo'),
                        'date': fixture_datetime,
                        'league': league_name,
                        'season': season,
                        'round': league_info.get('round', 'Round 1'),
                        'status': match_status,
                        'home_score': home_score if home_score is not None else 0,
                        'away_score': away_score if away_score is not None else 0,
                        'venue': fixture_info.get('venue', {}).get('name') if fixture_info.get('venue') else None,
                        'venue_city': fixture_info.get('venue', {}).get('city') if fixture_info.get('venue') else None,
                        'competition_id': competition_id,
                        'match_timestamp': fixture_datetime,
                        'last_updated': datetime.now(timezone.utc)
                    }
                }
                
                # Add scores if they exist (for updates)
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
    
    def _get_configured_leagues(self) -> List[Dict[str, Any]]:
        """
        Get all configured leagues with their API IDs and current seasons
        Returns:
            List of dictionaries with league_name, api_id, and api_season
        """
        leagues = []
        
        for league_name, config in SeasonManager.LEAGUE_CONFIGS.items():
            try:
                # Get current season in database format
                db_season = SeasonManager.get_current_season(league_name)
                
                # Convert to API season format
                api_season = SeasonManager.get_season_for_api(league_name, db_season)
                
                leagues.append({
                    "league_name": league_name,
                    "api_id": config["api_id"],
                    "api_season": int(api_season),
                    "db_season": db_season
                })
                
                logger.debug(f"Configured league: {league_name} (ID: {config['api_id']}, Season: {api_season})")
                
            except Exception as e:
                logger.error(f"Error getting season for {league_name}: {e}")
                continue
        
        return leagues
    
    async def _apply_rate_limit_delay(self) -> None:
        """
        Apply rate limiting delay between API requests
        Uses 500ms delay matching FootballAPIService pattern
        """
        if self.last_api_call:
            elapsed = (datetime.now(timezone.utc) - self.last_api_call).total_seconds()
            if elapsed < self.rate_limit_delay:
                sleep_time = self.rate_limit_delay - elapsed
                await asyncio.sleep(sleep_time)
        
        self.last_api_call = datetime.now(timezone.utc)
    
    async def _fetch_matches_for_league_parallel(
        self, 
        league_config: Dict[str, Any], 
        start_date: str, 
        end_date: str
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Fetch matches for a single league (for parallel execution)
        Returns tuple of (league_name, matches_data) for error tracking
        """
        league_name = league_config["league_name"]
        api_id = league_config["api_id"]
        api_season = league_config["api_season"]
        
        try:
            logger.debug(f"📡 Fetching matches for {league_name} (ID: {api_id}, Season: {api_season})")
            matches_data = await self._fetch_matches_by_date_range(
                start_date, end_date, api_id, api_season
            )
            logger.info(f"✅ {league_name}: Received {len(matches_data)} matches")
            return (league_name, matches_data)
        except Exception as e:
            logger.error(f"❌ Error fetching matches for {league_name}: {e}")
            return (league_name, [])
    
    async def _fetch_live_matches_for_league_parallel(
        self, 
        league_config: Dict[str, Any]
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Fetch live matches for a single league (for parallel execution)
        Returns tuple of (league_name, matches_data) for error tracking
        """
        league_name = league_config["league_name"]
        api_id = league_config["api_id"]
        api_season = league_config["api_season"]
        
        try:
            logger.debug(f"📡 Fetching live matches for {league_name} (ID: {api_id}, Season: {api_season})")
            matches_data = await self._fetch_live_matches(api_id, api_season)
            logger.info(f"✅ {league_name}: Received {len(matches_data)} live matches")
            return (league_name, matches_data)
        except Exception as e:
            logger.error(f"❌ Error fetching live matches for {league_name}: {e}")
            return (league_name, [])
    
    async def _fetch_matches_for_all_leagues_parallel(
        self,
        leagues: List[Dict[str, Any]],
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch matches for all leagues in parallel with rate limiting
        Uses semaphore to limit concurrent requests (max 3)
        """
        all_matches = []
        semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent requests
        
        async def fetch_with_semaphore(league_config):
            async with semaphore:
                return await self._fetch_matches_for_league_parallel(
                    league_config, start_date, end_date
                )
        
        # Create tasks for all leagues
        tasks = [fetch_with_semaphore(league) for league in leagues]
        
        # Execute in parallel and collect results
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"❌ Exception in parallel fetch: {result}")
                continue
            
            league_name, matches_data = result
            if matches_data:
                all_matches.extend(matches_data)
            else:
                logger.debug(f"⚠️ No matches returned for {league_name}")
        
        return all_matches
    
    async def _fetch_live_matches_for_all_leagues_parallel(
        self,
        leagues: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Fetch live matches for all leagues in parallel with rate limiting
        Uses semaphore to limit concurrent requests (max 3)
        """
        all_matches = []
        semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent requests
        
        async def fetch_with_semaphore(league_config):
            async with semaphore:
                return await self._fetch_live_matches_for_league_parallel(league_config)
        
        # Create tasks for all leagues
        tasks = [fetch_with_semaphore(league) for league in leagues]
        
        # Execute in parallel and collect results
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"❌ Exception in parallel live fetch: {result}")
                continue
            
            league_name, matches_data = result
            if matches_data:
                all_matches.extend(matches_data)
            else:
                logger.debug(f"⚠️ No live matches returned for {league_name}")
        
        return all_matches
    
    def get_api_status(self) -> Dict[str, Any]:
        """
        Get current API health status
        Returns dictionary with API state information
        """
        return {
            "api_subscription_active": self.api_subscription_active,
            "last_successful_call": self.api_last_successful_call.isoformat() if self.api_last_successful_call else None,
            "subscription_expired_at": self.api_subscription_expired_at.isoformat() if self.api_subscription_expired_at else None,
            "consecutive_failures": self.api_consecutive_failures,
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "rate_limit_active": self.rate_limit_hit,
            "rate_limit_resets_at": self.rate_limit_reset_time.isoformat() if self.rate_limit_reset_time else None
        }
    
    async def _test_api_availability(self) -> bool:
        """
        Test API availability with a minimal request
        Returns True if API is available, False otherwise
        Updates API health state based on result
        """
        try:
            logger.info("🔍 Testing API availability...")
            
            # Use a simple endpoint to test (e.g., get a single fixture)
            # We'll use the status endpoint or a minimal fixture request
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/status"
                async with session.get(url, headers=self.headers, timeout=10) as response:
                    if response.status == 200:
                        self.api_subscription_active = True
                        self.api_consecutive_failures = 0
                        self.api_last_successful_call = datetime.now(timezone.utc)
                        self.last_health_check = datetime.now(timezone.utc)
                        
                        if self.api_subscription_expired_at:
                            logger.info("✅ API subscription appears to be restored")
                            self.api_subscription_expired_at = None
                        
                        logger.info("✅ API availability test passed")
                        return True
                    elif response.status == 403:
                        self.api_subscription_active = False
                        self.api_consecutive_failures += 1
                        if not self.api_subscription_expired_at:
                            self.api_subscription_expired_at = datetime.now(timezone.utc)
                        self.last_health_check = datetime.now(timezone.utc)
                        logger.warning("⚠️ API availability test failed - subscription expired")
                        return False
                    else:
                        self.last_health_check = datetime.now(timezone.utc)
                        logger.warning(f"⚠️ API availability test returned status {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ API availability test error: {e}")
            self.last_health_check = datetime.now(timezone.utc)
            return False

# Global instance
match_status_updater = MatchStatusUpdater()