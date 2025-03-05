import json
import logging
import requests
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import asyncio
from functools import lru_cache

from ..core.config import settings
from ..db.repositories import create_or_update_fixture
from ..schemas.prediction import Match, MatchCreate, MatchStatus

# Configure logging
logger = logging.getLogger(__name__)

# Constants
API_BASE_URL = "https://v3.football.api-sports.io"
# Default rate limits (adjust based on your API subscription)
RATE_LIMIT_REQUESTS = 10  # Number of requests
RATE_LIMIT_PERIOD = 60    # In seconds (1 minute)

class RateLimiter:
    def __init__(self, max_calls: int, period: int):
        self.max_calls = max_calls
        self.period = period
        self.calls = []
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        """Acquire permission to make an API call"""
        async with self.lock:
            now = time.time()
            # Remove timestamps older than our period
            self.calls = [t for t in self.calls if now - t < self.period]
            
            if len(self.calls) >= self.max_calls:
                # We need to wait until we can make another call
                oldest_call = self.calls[0]
                sleep_time = self.period - (now - oldest_call)
                if sleep_time > 0:
                    logger.info(f"Rate limit reached. Waiting {sleep_time:.2f} seconds")
                    await asyncio.sleep(sleep_time)
            
            # Add the current timestamp to our calls
            self.calls.append(time.time())

class FootballApiService:
    def __init__(self):
        self.api_key = settings.FOOTBALL_API_KEY
        self.headers = {
            'x-rapidapi-key': self.api_key,
            'x-rapidapi-host': 'v3.football.api-sports.io'
        }
        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            max_calls=RATE_LIMIT_REQUESTS,
            period=RATE_LIMIT_PERIOD
        )
    
    async def make_api_request(self, endpoint: str, params: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        """Make request to football API with rate limiting"""
        url = f"{API_BASE_URL}/{endpoint}"
        
        # Acquire permission from rate limiter
        await self.rate_limiter.acquire()
        
        try:
            logger.info(f"Making API request to: {url} with params: {params}")
            response = requests.get(url, headers=self.headers, params=params)
            
            # Check for rate limit headers and update our limiter if needed
            if 'x-ratelimit-requests-remaining' in response.headers:
                remaining = int(response.headers['x-ratelimit-requests-remaining'])
                logger.info(f"API requests remaining: {remaining}")
                
                # If we're getting low on requests, slow down more
                if remaining < 5:
                    logger.warning(f"API request quota running low: {remaining} remaining")
            
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get('response') and data.get('errors'):
                logger.error(f"API Error: {data['errors']}")
                return None
            
            logger.info(f"API request successful. Found {len(data.get('response', []))} items")
            return data.get('response', [])
        
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                logger.error("Rate limit exceeded!")
                # If we hit the rate limit, wait longer before next request
                await asyncio.sleep(60)  # Wait a minute
            logger.error(f"HTTP Error: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"API Request failed: {e}")
            return None

    # Cache results for 1 hour for fixtures by season (they don't change often)
    @lru_cache(maxsize=32)
    async def get_fixtures_by_season(self, league_id: int, season: int) -> Optional[List[Dict[str, Any]]]:
        """Get fixtures for a specific league and season"""
        params = {
            'league': league_id,
            'season': season
        }
        return await self.make_api_request('fixtures', params)
    
    # Don't cache live fixtures - they change frequently
    async def get_live_fixtures(self, league_id: int) -> Optional[List[Dict[str, Any]]]:
        """Get live fixtures for a specific league"""
        params = {
            'league': league_id,
            'live': 'all'
        }
        return await self.make_api_request('fixtures', params)
    
    # Cache fixture details for 5 minutes
    @lru_cache(maxsize=128)
    async def get_fixture_by_id(self, fixture_id: int) -> Optional[Dict[str, Any]]:
        """Get fixture by ID"""
        params = {
            'id': fixture_id
        }
        fixtures = await self.make_api_request('fixtures', params)
        return fixtures[0] if fixtures and len(fixtures) > 0 else None
    
    async def save_fixtures_to_db(self, db, fixtures: List[Dict[str, Any]]) -> int:
        """Save fixtures to database"""
        count = 0
        for fixture_data in fixtures:
            try:
                # Parse fixture data
                fixture_datetime = datetime.fromisoformat(
                    fixture_data['fixture']['date'].replace('Z', '+00:00')
                )
                
                # Map API status to our status enum
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
                
                status = status_mapping.get(fixture_data['fixture']['status']['short'], MatchStatus.NOT_STARTED)
                
                # Create fixture data for database
                db_fixture_data = {
                    "fixture_id": fixture_data['fixture']['id'],
                    "home_team": fixture_data['teams']['home']['name'],
                    "away_team": fixture_data['teams']['away']['name'],
                    "home_team_logo": fixture_data['teams']['home']['logo'],
                    "away_team_logo": fixture_data['teams']['away']['logo'],
                    "date": fixture_datetime,
                    "league": fixture_data['league']['name'],
                    "season": str(fixture_data['league']['season']),
                    "round": fixture_data['league']['round'],
                    "status": status,
                    "home_score": fixture_data['goals']['home'] if fixture_data['goals']['home'] is not None else 0,
                    "away_score": fixture_data['goals']['away'] if fixture_data['goals']['away'] is not None else 0,
                    "venue_city": fixture_data['fixture']['venue']['city'] if 'venue' in fixture_data['fixture'] else None,
                    "competition_id": fixture_data['league']['id'],
                    "match_timestamp": fixture_datetime,
                    "last_updated": datetime.now(timezone.utc)
                }
                
                # Add scores if available
                if 'score' in fixture_data:
                    if 'halftime' in fixture_data['score']:
                        db_fixture_data['halftime_score'] = f"{fixture_data['score']['halftime']['home']}-{fixture_data['score']['halftime']['away']}"
                    if 'fulltime' in fixture_data['score']:
                        db_fixture_data['fulltime_score'] = f"{fixture_data['score']['fulltime']['home']}-{fixture_data['score']['fulltime']['away']}"
                    if 'extratime' in fixture_data['score']:
                        db_fixture_data['extratime_score'] = f"{fixture_data['score']['extratime']['home']}-{fixture_data['score']['extratime']['away']}"
                    if 'penalty' in fixture_data['score']:
                        db_fixture_data['penalty_score'] = f"{fixture_data['score']['penalty']['home']}-{fixture_data['score']['penalty']['away']}"
                
                # Save to database
                await create_or_update_fixture(db, db_fixture_data)
                count += 1
                logger.info(f"Saved fixture {fixture_data['fixture']['id']} to database")
                
            except Exception as e:
                logger.error(f"Error processing fixture {fixture_data['fixture']['id']}: {e}")
                continue
        
        return count
    
    # Rest of the methods remain the same
    # ...

# Create a singleton instance
football_api_service = FootballApiService()

# Dependency
def get_football_api_service():
    return football_api_service 