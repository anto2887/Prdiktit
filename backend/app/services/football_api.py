# backend/app/services/football_api.py
"""
Enhanced Football API Service with proper async/await handling

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
        self.base_url = "https://v3.football.api-sports.io"  # ← Changed to correct API endpoint
        self.session = None
        self.rate_limit_delay = 0.5  # 500ms between requests (more conservative)
        self.last_request_time = None
        
        # Headers for API requests (correct format)
        self.headers = {
            "x-rapidapi-key": self.api_key,                    # ← Changed from "X-RapidAPI-Key"
            "x-rapidapi-host": "v3.football.api-sports.io"     # ← Changed the host
        }
        
        # Track if we're in a proper async context
        self._loop = None
        
    async def _ensure_session(self) -> aiohttp.ClientSession:
        """Ensure we have a valid HTTP session in the current event loop"""
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            # No event loop running - this shouldn't happen in async context
            logger.error("❌ No event loop running - cannot create session")
            raise RuntimeError("Must be called from within an async context")
        
        # If session doesn't exist or is closed or from different loop, create new one
        if (self.session is None or 
            self.session.closed or 
            self._loop != current_loop):
            
            if self.session and not self.session.closed:
                await self.session.close()
            
            # Create new session with proper timeout configuration
            timeout = aiohttp.ClientTimeout(
                total=30,        # Total timeout for the request
                connect=10,      # Timeout for connection
                sock_read=20     # Socket read timeout
            )
            
            self.session = aiohttp.ClientSession(
                headers=self.headers,
                timeout=timeout,
                connector=aiohttp.TCPConnector(
                    limit=10,                    # Connection pool limit
                    limit_per_host=5,           # Connections per host
                    ttl_dns_cache=300,          # DNS cache TTL
                    use_dns_cache=True,
                )
            )
            self._loop = current_loop
            logger.debug("✅ Created new aiohttp session")
        
        return self.session
    
    async def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """Make rate-limited API request with proper error handling"""
        if not self.api_key:
            logger.error("❌ No API key configured")
            return {}
        
        try:
            # Ensure we're in an async context
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                logger.error("❌ _make_request called outside async context")
                return {}
            
            # Rate limiting
            if self.last_request_time:
                elapsed = (datetime.now() - self.last_request_time).total_seconds()
                if elapsed < self.rate_limit_delay:
                    await asyncio.sleep(self.rate_limit_delay - elapsed)
            
            session = await self._ensure_session()
            url = f"{self.base_url}/{endpoint}"
            
            logger.debug(f"🔗 Making API request to: {endpoint}")
            
            # Log response status for debugging
            async with session.get(url, params=params) as response:
                logger.debug(f"📡 API Response: {response.status} for {endpoint}")
                
                if response.status == 200:
                    data = await response.json()
                    self.last_request_time = datetime.now()
                    
                    # Extract the response data
                    if 'response' in data:
                        return data['response']
                    else:
                        logger.warning(f"Unexpected API response format for {endpoint}")
                        return data
                        
                elif response.status == 429:
                    logger.warning(f"Rate limit hit for {endpoint}, waiting...")
                    await asyncio.sleep(2)  # Wait 2 seconds before retry
                    return await self._make_request(endpoint, params)  # Retry once
                    
                else:
                    logger.error(f"❌ API request failed for {endpoint}: {response.status}")
                    error_text = await response.text()
                    logger.error(f"Error details: {error_text}")
                    return {}
                    
        except aiohttp.ClientError as e:
            logger.error(f"❌ Network error for {endpoint}: {e}")
            return {}
        except Exception as e:
            logger.error(f"❌ Unexpected error for {endpoint}: {e}")
            return {}

    async def make_api_request(self, endpoint: str, params: Dict = None) -> Dict:
        """
        Public method to make API requests - wrapper around _make_request
        This is the method that init_services.py expects to call
        """
        return await self._make_request(endpoint, params)
    
    async def get_fixtures_by_date_range(
        self, 
        from_date: datetime, 
        to_date: datetime, 
        league_ids: Optional[List[int]] = None
    ) -> List[Dict]:
        """
        Get fixtures within a date range
        
        Args:
            from_date: Start date (timezone-aware)
            to_date: End date (timezone-aware)
            league_ids: Optional list of league IDs
            
        Returns:
            List of fixture dictionaries
        """
        try:
            # Ensure we're in async context
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                logger.error("❌ get_fixtures_by_date_range called outside async context")
                return []
            
            all_fixtures = []
            
            # Default leagues if none specified
            if not league_ids:
                league_ids = [39, 140, 78, 135, 61, 253, 848]  # Major leagues
            
            # Format dates for API
            from_str = from_date.strftime('%Y-%m-%d')
            to_str = to_date.strftime('%Y-%m-%d')
            
            logger.info(f"📡 Fetching fixtures from {from_str} to {to_str} for {len(league_ids)} leagues")
            
            for league_id in league_ids:
                try:
                    params = {
                        'league': league_id,
                        'season': '2024',  # Current season
                        'from': from_str,
                        'to': to_str
                    }
                    
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
            # Ensure we're in async context
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                logger.error("❌ get_fixture_by_id called outside async context")
                return None
            
            params = {'id': fixture_id}
            response = await self._make_request('fixtures', params)
            
            if response and 'response' in response and len(response['response']) > 0:
                fixture_data = response['response'][0]
                return await self._standardize_fixture(fixture_data)
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error fetching fixture {fixture_id}: {e}")
            return None
    
    async def _standardize_fixture(self, api_fixture: Dict) -> Optional[Dict]:
        """
        Convert API fixture data to our standardized format
        
        Args:
            api_fixture: Raw fixture data from API
            
        Returns:
            Standardized fixture dictionary or None
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
                'date': parsed_date,
                'status': mapped_status,
                'league_id': league_info.get('id'),
                'league_name': league_info.get('name'),
                'home_team': teams.get('home', {}).get('name'),
                'away_team': teams.get('away', {}).get('name'),
                'home_team_id': teams.get('home', {}).get('id'),
                'away_team_id': teams.get('away', {}).get('id'),
                'home_score': goals.get('home'),
                'away_score': goals.get('away'),
                'venue': fixture_info.get('venue', {}).get('name'),
                'referee': fixture_info.get('referee'),
                'last_updated': datetime.now(timezone.utc)
            }
            
            # Validate required fields
            if not standardized['fixture_id']:
                logger.warning("⚠️ Fixture missing ID, skipping")
                return None
            
            if not standardized['home_team'] or not standardized['away_team']:
                logger.warning(f"⚠️ Fixture {standardized['fixture_id']} missing team names, skipping")
                return None
            
            return standardized
            
        except Exception as e:
            logger.error(f"❌ Error standardizing fixture: {e}")
            return None
    
    async def test_api_connection(self) -> bool:
        """
        Test if API connection is working
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Ensure we're in async context
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                logger.error("❌ test_api_connection called outside async context")
                return False
            
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
            self.session = None
            self._loop = None
            logger.info("✅ Football API session closed")

# Global instance
football_api_service = FootballAPIService() 