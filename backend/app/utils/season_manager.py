# backend/app/utils/season_manager.py
"""
Comprehensive season management utility that handles different league formats
"""
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple
from enum import Enum


class LeagueType(Enum):
    """Different types of league season formats"""
    EUROPEAN = "european"  # 2024-25 format (Aug-May)
    CALENDAR_YEAR = "calendar_year"  # 2025 format (Jan-Dec) 
    MLS = "mls"  # 2025 format (Feb-Nov)
    TOURNAMENT = "tournament"  # 2025 format (specific dates)


class SeasonManager:
    """Manages season formats across different leagues"""
    
    # League configurations with their season patterns
    LEAGUE_CONFIGS = {
        "Premier League": {
            "type": LeagueType.EUROPEAN,
            "api_id": 39,
            "display_format": "{start_year}-{end_year_short}",  # "2024-25"
            "db_format": "{start_year}-{end_year}",  # "2024-2025"
            "api_season": "{start_year}",  # API uses start year
        },
        "La Liga": {
            "type": LeagueType.EUROPEAN,
            "api_id": 140,
            "display_format": "{start_year}-{end_year_short}",
            "db_format": "{start_year}-{end_year}",
            "api_season": "{start_year}",
        },
        "UEFA Champions League": {
            "type": LeagueType.EUROPEAN,
            "api_id": 2,
            "display_format": "{start_year}-{end_year_short}",
            "db_format": "{start_year}-{end_year}",
            "api_season": "{start_year}",
        },
        "MLS": {
            "type": LeagueType.MLS,
            "api_id": 253,
            "display_format": "{year}",  # "2025"
            "db_format": "{year}",  # "2025"
            "api_season": "{year}",  # "2025"
        },
        "FIFA Club World Cup": {
            "type": LeagueType.TOURNAMENT,
            "api_id": 15,
            "display_format": "{year}",
            "db_format": "{year}",
            "api_season": "{year}",
        }
    }
    
    @classmethod
    def get_current_season(cls, league_name: str) -> str:
        """Get the current season for a league in database format"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            # Default to calendar year for unknown leagues
            return str(datetime.now().year)
        
        now = datetime.now()
        
        if config["type"] == LeagueType.EUROPEAN:
            # European season runs Aug-May
            if now.month >= 8:  # August or later = new season
                start_year = now.year
                end_year = now.year + 1
            else:  # Before August = previous season
                start_year = now.year - 1
                end_year = now.year
                
            return config["db_format"].format(
                start_year=start_year,
                end_year=end_year,
                end_year_short=str(end_year)[2:]
            )
            
        elif config["type"] in [LeagueType.MLS, LeagueType.CALENDAR_YEAR, LeagueType.TOURNAMENT]:
            # Calendar year leagues
            return config["db_format"].format(year=now.year)
    
    @classmethod
    def get_season_for_api(cls, league_name: str, db_season: str) -> str:
        """Convert database season format to API season format"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            return db_season
            
        if config["type"] == LeagueType.EUROPEAN:
            # Extract start year from "2024-2025" format
            start_year = db_season.split("-")[0]
            return start_year
        else:
            # For MLS and tournaments, use as-is
            return db_season
    
    @classmethod
    def get_season_for_display(cls, league_name: str, db_season: str) -> str:
        """Convert database season to display format"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            return db_season
            
        if config["type"] == LeagueType.EUROPEAN:
            if "-" in db_season:
                start_year, end_year = db_season.split("-")
                end_year_short = end_year[2:]  # "2025" -> "25"
                return f"{start_year}-{end_year_short}"
            else:
                # Handle legacy format
                return db_season
        else:
            return db_season
    
    @classmethod
    def convert_to_db_format(cls, league_name: str, season_input: str) -> str:
        """Convert any season format to database format"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            return season_input
            
        if config["type"] == LeagueType.EUROPEAN:
            if "-" in season_input:
                parts = season_input.split("-")
                start_year = parts[0]
                end_part = parts[1]
                
                # Handle both "24" and "2024" end formats
                if len(end_part) == 2:
                    end_year = start_year[:2] + end_part  # "2024" + "25" = "2025"
                else:
                    end_year = end_part
                    
                return f"{start_year}-{end_year}"
            else:
                # Single year input, assume European format
                start_year = int(season_input)
                end_year = start_year + 1
                return f"{start_year}-{end_year}"
        else:
            return season_input
    
    @classmethod
    def get_available_seasons(cls, league_name: str, years_back: int = 5) -> List[Dict[str, str]]:
        """Get list of available seasons for a league"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            # Default to calendar years
            current_year = datetime.now().year
            return [
                {
                    "value": str(year),
                    "label": str(year),
                    "db_format": str(year)
                }
                for year in range(current_year, current_year - years_back, -1)
            ]
        
        seasons = []
        current_year = datetime.now().year
        
        if config["type"] == LeagueType.EUROPEAN:
            # Generate European seasons
            for i in range(years_back + 1):
                start_year = current_year - i
                end_year = start_year + 1
                
                db_format = f"{start_year}-{end_year}"
                display_format = f"{start_year}-{str(end_year)[2:]}"
                
                seasons.append({
                    "value": db_format,
                    "label": display_format,
                    "db_format": db_format
                })
        else:
            # Calendar year leagues
            for i in range(years_back + 1):
                year = current_year - i
                seasons.append({
                    "value": str(year),
                    "label": str(year),
                    "db_format": str(year)
                })
        
        return seasons
    
    @classmethod
    def is_valid_season_format(cls, league_name: str, season: str) -> bool:
        """Validate if season format is correct for the league"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            return True  # Accept any format for unknown leagues
            
        if config["type"] == LeagueType.EUROPEAN:
            # Should be "YYYY-YYYY" format
            if "-" not in season:
                return False
            parts = season.split("-")
            if len(parts) != 2:
                return False
            try:
                start_year = int(parts[0])
                end_year = int(parts[1])
                return end_year == start_year + 1
            except ValueError:
                return False
        else:
            # Calendar year should be just "YYYY"
            try:
                int(season)
                return len(season) == 4
            except ValueError:
                return False
    
    @classmethod
    def get_league_config(cls, league_name: str) -> Optional[Dict]:
        """Get league configuration"""
        return cls.LEAGUE_CONFIGS.get(league_name)
    
    @classmethod
    def normalize_season_for_query(cls, league_name: str, season_input: str) -> str:
        """Normalize season input for database queries"""
        if not season_input:
            return cls.get_current_season(league_name)
        
        return cls.convert_to_db_format(league_name, season_input)


# Example usage and tests
if __name__ == "__main__":
    sm = SeasonManager()
    
    # Test different leagues
    print("=== Current Seasons ===")
    for league in sm.LEAGUE_CONFIGS.keys():
        current = sm.get_current_season(league)
        print(f"{league}: {current}")
    
    print("\n=== Available Seasons ===")
    for league in ["Premier League", "MLS"]:
        seasons = sm.get_available_seasons(league, 3)
        print(f"{league}:")
        for season in seasons:
            print(f"  {season['label']} -> DB: {season['db_format']}")
    
    print("\n=== Format Conversions ===")
    test_cases = [
        ("Premier League", "2024-25", "display"),
        ("Premier League", "2024-2025", "api"),
        ("MLS", "2025", "display"),
        ("MLS", "2025", "api"),
    ]
    
    for league, season, conversion_type in test_cases:
        if conversion_type == "display":
            result = sm.get_season_for_display(league, season)
        else:
            result = sm.get_season_for_api(league, season)
        print(f"{league} {season} -> {conversion_type}: {result}")