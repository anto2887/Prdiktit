# backend/app/services/football_api.py
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from ..core.config import settings

logger = logging.getLogger(__name__)

class FootballAPIService:
    """
    Service for fetching fixture updates from external football API
    Integrates with your existing football API for proactive monitoring
    """
    
    def __init__(self):
        self.api_key = settings.FOOTBALL_API_KEY
        self.base_url = "https://v3.football.api-sports.io"
        self.headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "v3.football.api-sports.io"
        }
        self.session = None
        
        # Rate limiting
        self.last_request_time = None
        self.min_request_interval = 1.0  # Minimum 1 second between requests
    
    async def _get_session(self):
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(
                headers=self.headers,
                timeout=timeout
            )
        return self.session
    
    async def _rate_limit(self):
        """Ensure we don't exceed API rate limits"""
        if self.last_request_time:
            elapsed = (datetime.now(timezone.utc) - self.last_request_time).total_seconds()
            if elapsed < self.min_request_interval:
                sleep_time = self.min_request_interval - elapsed
                logger.debug(f"Rate limiting: sleeping {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
        
        self.last_request_time = datetime.now(timezone.utc)
    
    async def make_api_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Make a request to the football API
        
        Args:
            endpoint: API endpoint (e.g., 'fixtures', 'teams', 'leagues')
            params: Query parameters for the API request
            
        Returns:
            List of response data or None if error
        """
        if not self.api_key:
            logger.error("Football API key not configured")
            return None
        
        if params is None:
            params = {}
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            # Rate limiting
            await self._rate_limit()
            
            session = await self._get_session()
            
            logger.debug(f"Making API request to: {url} with params: {params}")
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check for API errors
                    if data.get('errors') and len(data['errors']) > 0:
                        logger.error(f"API returned errors: {data['errors']}")
                        return None
                    
                    # Return the response data
                    response_data = data.get('response', [])
                    logger.debug(f"API request successful. Found {len(response_data)} items")
                    return response_data
                    
                elif response.status == 429:
                    logger.warning("API rate limit exceeded, waiting...")
                    await asyncio.sleep(5)
                    return None
                    
                else:
                    logger.error(f"API request failed with status {response.status}: {await response.text()}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error(f"API request timeout for {url}")
            return None
        except aiohttp.ClientError as e:
            logger.error(f"API request error for {url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error making API request to {url}: {e}")
            return None
    
    async def get_fixture_by_id(self, fixture_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch a single fixture by ID from the API
        Returns the latest fixture data
        """
        params = {'id': fixture_id}
        fixtures = await self.make_api_request('fixtures', params)
        
        if fixtures and len(fixtures) > 0:
            return fixtures[0]
        return None
    
    async def get_fixtures_by_date(self, date: str, league_id: int = None) -> List[Dict[str, Any]]:
        """
        Get fixtures for a specific date
        
        Args:
            date: Date in YYYY-MM-DD format
            league_id: Optional league ID to filter by
            
        Returns:
            List of fixtures
        """
        params = {'date': date}
        if league_id:
            params['league'] = league_id
            
        fixtures = await self.make_api_request('fixtures', params)
        return fixtures or []
    
    async def get_fixtures_by_date_range(self, from_date: str, to_date: str, league_id: int = None) -> List[Dict[str, Any]]:
        """
        Get fixtures for a date range
        
        Args:
            from_date: Start date in YYYY-MM-DD format
            to_date: End date in YYYY-MM-DD format
            league_id: Optional league ID to filter by
            
        Returns:
            List of fixtures
        """
        params = {
            'from': from_date,
            'to': to_date
        }
        if league_id:
            params['league'] = league_id
            
        fixtures = await self.make_api_request('fixtures', params)
        return fixtures or []
    
    async def get_live_fixtures(self, league_id: int = None) -> List[Dict[str, Any]]:
        """
        Get live fixtures
        
        Args:
            league_id: Optional league ID to filter by
            
        Returns:
            List of live fixtures
        """
        params = {'live': 'all'}
        if league_id:
            params['league'] = league_id
            
        fixtures = await self.make_api_request('fixtures', params)
        return fixtures or []
    
    async def get_teams_by_league(self, league_id: int, season: int) -> List[Dict[str, Any]]:
        """
        Get teams for a specific league and season
        
        Args:
            league_id: League ID
            season: Season year
            
        Returns:
            List of teams
        """
        params = {
            'league': league_id,
            'season': season
        }
        
        teams = await self.make_api_request('teams', params)
        return teams or []
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.debug("Football API session closed")

# Create global instance
football_api_service = FootballAPIService() 