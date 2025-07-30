# backend/app/services/football_api.py
"""
Enhanced Football API Service

This service provides comprehensive football data fetching capabilities
with support for fixture synchronization and real-time updates.
"""

import asyncio
import aiohttp
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from ..core.config import settings

logger = logging.getLogger(__name__)

class FootballAPIService:
    """Enhanced service for interacting with football data API"""
    
    def __init__(self):
        self.api_key = settings.FOOTBALL_API_KEY
        self.base_url = "https://api-football-v1.p.rapidapi.com/v3"
        self.session = None
        self.rate_limit_delay = 0.1  # 100ms between requests
        self.last_request_time = None
        
        # Headers for API requests
        self.headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers=self.headers,
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self.session
    
    async def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """Make rate-limited API request"""
        try:
            # Rate limiting
            if self.last_request_time:
                elapsed = (datetime.now() - self.last_request_time).total_seconds()
                if elapsed < self.rate_limit_delay:
                    await asyncio.sleep(self.rate_limit_delay - elapsed)
            
            session = await self._get_session()
            url = f"{self.base_url}/{endpoint}"
            
            async with session.get(url, params=params) as response:
                self.last_request_time = datetime.now()
                
                if response.status == 200:
                    data = await response.json()
                    return data
                elif response.status == 429:
                    logger.warning("⚠️ Rate limit exceeded, waiting...")
                    await asyncio.sleep(60)  # Wait 1 minute for rate limit reset
                    return await self._make_request(endpoint, params)  # Retry
                else:
                    logger.error(f"❌ API request failed: {response.status}")
                    return {}
                    
        except Exception as e:
            logger.error(f"❌ Error making API request to {endpoint}: {e}")
            return {}
    
    async def get_fixtures_by_date_range(self, start_date: str, end_date: str, league_ids: List[int] = None) -> List[Dict]:
        """
        Get fixtures within a date range
        
        Args:
            start_date: ISO format date string (e.g., "2024-01-01")
            end_date: ISO format date string (e.g., "2024-01-31") 
            league_ids: Optional list of league IDs to filter by
            
        Returns:
            List of fixture dictionaries in standardized format
        """
        try:
            all_fixtures = []
            
            # Default leagues if none specified (adapt to your needs)
            if not league_ids:
                league_ids = [
                    39,    # Premier League
                    140,   # La Liga
                    78,    # Bundesliga
                    135,   # Serie A
                    61,    # Ligue 1
                    253,   # MLS
                    848    # FIFA Club World Cup
                ]
            
            logger.info(f"📡 Fetching fixtures from {start_date} to {end_date} for {len(league_ids)} leagues")
            
            for league_id in league_ids:
                try:
                    # Convert date strings to proper format for API
                    start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    
                    # API typically wants date in YYYY-MM-DD format
                    api_start = start_dt.strftime('%Y-%m-%d')
                    api_end = end_dt.strftime('%Y-%m-%d')
                    
                    params = {
                        'league': league_id,
                        'season': '2024',  # Adjust based on current season
                        'from': api_start,
                        'to': api_end
                    }
                    
                    logger.debug(f"🔍 Fetching fixtures for league {league_id}")
                    response = await self._make_request('fixtures', params)
                    
                    if response and 'response' in response:
                        fixtures = response['response']
                        
                        for fixture_data in fixtures:
                            try:
                                # Convert API response to our standardized format
                                standardized_fixture = await self._standardize_fixture(fixture_data)
                                if standardized_fixture:
                                    all_fixtures.append(standardized_fixture)
                                    
                            except Exception as e:
                                logger.error(f"❌ Error standardizing fixture: {e}")
                                continue
                        
                        logger.debug(f"✅ Retrieved {len(fixtures)} fixtures for league {league_id}")
                    
                    # Rate limiting between league requests
                    await asyncio.sleep(self.rate_limit_delay)
                    
                except Exception as e:
                    logger.error(f"❌ Error fetching fixtures for league {league_id}: {e}")
                    continue
            
            logger.info(f"✅ Total fixtures retrieved: {len(all_fixtures)}")
            return all_fixtures
            
        except Exception as e:
            logger.error(f"❌ Error in get_fixtures_by_date_range: {e}")
            return []
    
    async def get_fixture_by_id(self, fixture_id: int) -> Optional[Dict]:
        """
        Get a specific fixture by ID
        
        Args:
            fixture_id: The fixture ID
            
        Returns:
            Standardized fixture dictionary or None
        """
        try:
            params = {'id': fixture_id}
            response = await self._make_request('fixtures', params)
            
            if response and 'response' in response and len(response['response']) > 0:
                fixture_data = response['response'][0]
                return await self._standardize_fixture(fixture_data)
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error fetching fixture {fixture_id}: {e}")
            return None
    
    async def _standardize_fixture(self, api_fixture: Dict) -> Dict:
        """
        Convert API fixture data to our standardized format
        
        Args:
            api_fixture: Raw fixture data from API
            
        Returns:
            Standardized fixture dictionary
        """
        try:
            # Extract fixture info
            fixture_info = api_fixture.get('fixture', {})
            teams = api_fixture.get('teams', {})
            league_info = api_fixture.get('league', {})
            goals = api_fixture.get('goals', {})
            
            # Map API status to our MatchStatus enum values
            status_mapping = {
                'TBD': 'NOT_STARTED',
                'NS': 'NOT_STARTED',
                '1H': 'FIRST_HALF', 
                'HT': 'HALFTIME',
                '2H': 'SECOND_HALF',
                'ET': 'EXTRA_TIME',
                'P': 'PENALTY',
                'FT': 'FINISHED',
                'AET': 'FINISHED_AET',
                'PEN': 'FINISHED_PEN',
                'SUSP': 'SUSPENDED',
                'INT': 'INTERRUPTED',
                'PST': 'POSTPONED',
                'CANC': 'CANCELLED',
                'ABD': 'ABANDONED',
                'AWD': 'TECHNICAL_LOSS',
                'WO': 'WALKOVER',
                'LIVE': 'LIVE'
            }
            
            api_status = fixture_info.get('status', {}).get('short', 'NS')
            mapped_status = status_mapping.get(api_status, 'NOT_STARTED')
            
            # Parse date
            fixture_date = fixture_info.get('date')
            if fixture_date:
                # Convert to datetime object
                parsed_date = datetime.fromisoformat(fixture_date.replace('Z', '+00:00'))
            else:
                parsed_date = datetime.now(timezone.utc)
            
            # Build standardized fixture
            standardized = {
                'fixture_id': fixture_info.get('id'),
                'home_team': teams.get('home', {}).get('name', ''),
                'away_team': teams.get('away', {}).get('name', ''),
                'date': parsed_date.isoformat(),
                'league': league_info.get('name', ''),
                'season': league_info.get('season', '2024'),
                'round': league_info.get('round', ''),
                'status': mapped_status,
                'home_score': goals.get('home') if goals.get('home') is not None else None,
                'away_score': goals.get('away') if goals.get('away') is not None else None,
                'venue': fixture_info.get('venue', {}).get('name'),
                'venue_city': fixture_info.get('venue', {}).get('city'),
                'referee': fixture_info.get('referee'),
                'home_team_logo': teams.get('home', {}).get('logo'),
                'away_team_logo': teams.get('away', {}).get('logo')
            }
            
            return standardized
            
        except Exception as e:
            logger.error(f"❌ Error standardizing fixture: {e}")
            return None
    
    async def get_live_fixtures(self) -> List[Dict]:
        """
        Get all currently live fixtures
        
        Returns:
            List of live fixture dictionaries
        """
        try:
            params = {'live': 'all'}
            response = await self._make_request('fixtures', params)
            
            live_fixtures = []
            if response and 'response' in response:
                for fixture_data in response['response']:
                    standardized = await self._standardize_fixture(fixture_data)
                    if standardized:
                        live_fixtures.append(standardized)
            
            return live_fixtures
            
        except Exception as e:
            logger.error(f"❌ Error fetching live fixtures: {e}")
            return []
    
    async def get_fixtures_by_status(self, status: str, league_ids: List[int] = None) -> List[Dict]:
        """
        Get fixtures by status (e.g., 'FT' for finished)
        
        Args:
            status: API status code (FT, NS, LIVE, etc.)
            league_ids: Optional list of league IDs
            
        Returns:
            List of fixture dictionaries
        """
        try:
            all_fixtures = []
            
            # Default leagues if none specified
            if not league_ids:
                league_ids = [39, 140, 78, 135, 61, 253, 848]
            
            for league_id in league_ids:
                try:
                    params = {
                        'league': league_id,
                        'season': '2024',
                        'status': status
                    }
                    
                    response = await self._make_request('fixtures', params)
                    
                    if response and 'response' in response:
                        for fixture_data in response['response']:
                            standardized = await self._standardize_fixture(fixture_data)
                            if standardized:
                                all_fixtures.append(standardized)
                    
                    await asyncio.sleep(self.rate_limit_delay)
                    
                except Exception as e:
                    logger.error(f"❌ Error fetching {status} fixtures for league {league_id}: {e}")
                    continue
            
            return all_fixtures
            
        except Exception as e:
            logger.error(f"❌ Error in get_fixtures_by_status: {e}")
            return []
    
    async def test_api_connection(self) -> bool:
        """
        Test if API connection is working
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            logger.info("🔗 Testing API connection...")
            
            # Test with a simple timezone request
            response = await self._make_request('timezone')
            
            if response and 'response' in response:
                logger.info("✅ API connection successful")
                return True
            else:
                logger.error("❌ API connection failed - no response")
                return False
                
        except Exception as e:
            logger.error(f"❌ API connection test failed: {e}")
            return False
    
    async def close(self):
        """Close the HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("✅ Football API session closed")

# Global instance
football_api_service = FootballAPIService() 