# backend/app/utils/season_manager.py
"""
Comprehensive season management utility that handles different league formats
"""
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)

# Optional override when API-Football uses a non-obvious season year for league id 15.
CLUB_WORLD_CUP_API_SEASON_ENV = "CLUB_WORLD_CUP_API_SEASON"


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
        # FIFA World Cup (men's) — API-Football v3: league id 1, season 2026 for WC 2026
        "World Cup": {
            "type": LeagueType.TOURNAMENT,
            "api_id": 1,
            "display_format": "{year}",
            "db_format": "{year}",
            "api_season": "{year}",
            # Calendar TOURNAMENT would use datetime.utcnow().year; WC 2026 uses API season 2026 in 2025–2026.
            "pinned_db_season": "2026",
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

    @staticmethod
    def _european_campaign_start_year(now: datetime) -> int:
        """Start year of the European league season containing ``now`` (August flip)."""
        if now.month >= 8:
            return now.year
        return now.year - 1

    @staticmethod
    def _mls_campaign_calendar_year(now: datetime) -> int:
        """MLS campaign label year: new season from February (option A). Jan -> prior year."""
        if now.month >= 2:
            return now.year
        return now.year - 1

    @classmethod
    def _warn_unknown_league(cls, league_name: str, method: str) -> None:
        logger.warning(
            "SeasonManager.%s: unknown league %r — using best-effort fallback; "
            "add LEAGUE_CONFIGS entry for deterministic behavior",
            method,
            league_name,
        )

    @classmethod
    def get_current_season(cls, league_name: str) -> str:
        """Get the current season for a league in database format"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            cls._warn_unknown_league(league_name, "get_current_season")
            return str(datetime.now(timezone.utc).year)

        pinned = config.get("pinned_db_season")
        if pinned:
            return pinned
        
        now = datetime.now(timezone.utc)
        
        if config["type"] == LeagueType.EUROPEAN:
            start_year = cls._european_campaign_start_year(now)
            end_year = start_year + 1
            return config["db_format"].format(
                start_year=start_year,
                end_year=end_year,
                end_year_short=str(end_year)[2:]
            )

        if config["type"] == LeagueType.MLS:
            y = cls._mls_campaign_calendar_year(now)
            return config["db_format"].format(year=y)

        if config["type"] == LeagueType.CALENDAR_YEAR:
            return config["db_format"].format(year=now.year)

        if config["type"] == LeagueType.TOURNAMENT:
            if league_name == "FIFA Club World Cup":
                override = os.environ.get(CLUB_WORLD_CUP_API_SEASON_ENV, "").strip()
                if override:
                    return override
            return config["db_format"].format(year=now.year)

        return str(now.year)
    
    @classmethod
    def get_season_for_api(cls, league_name: str, db_season: str) -> str:
        """Convert database season format to API season format"""
        config = cls.LEAGUE_CONFIGS.get(league_name)
        if not config:
            cls._warn_unknown_league(league_name, "get_season_for_api")
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
            cls._warn_unknown_league(league_name, "get_season_for_display")
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
            cls._warn_unknown_league(league_name, "convert_to_db_format")
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
        now = datetime.now(timezone.utc)
        if not config:
            cls._warn_unknown_league(league_name, "get_available_seasons")
            current_year = now.year
            return [
                {
                    "value": str(year),
                    "label": str(year),
                    "db_format": str(year)
                }
                for year in range(current_year, current_year - years_back, -1)
            ]
        
        seasons = []

        pinned = config.get("pinned_db_season")
        if pinned:
            try:
                anchor = int(pinned)
            except ValueError:
                anchor = now.year
            for i in range(years_back + 1):
                y = anchor - 4 * i
                ys = str(y)
                seasons.append({"value": ys, "label": ys, "db_format": ys})
            return seasons

        if config["type"] == LeagueType.EUROPEAN:
            start_year = cls._european_campaign_start_year(now)
            for i in range(years_back + 1):
                sy = start_year - i
                ey = sy + 1
                db_format = f"{sy}-{ey}"
                display_format = f"{sy}-{str(ey)[2:]}"
                seasons.append({
                    "value": db_format,
                    "label": display_format,
                    "db_format": db_format
                })
        elif config["type"] == LeagueType.MLS:
            anchor = cls._mls_campaign_calendar_year(now)
            for i in range(years_back + 1):
                year = anchor - i
                seasons.append({
                    "value": str(year),
                    "label": str(year),
                    "db_format": str(year)
                })
        else:
            try:
                anchor = int(cls.get_current_season(league_name))
            except ValueError:
                anchor = now.year
            for i in range(years_back + 1):
                year = anchor - i
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
            cls._warn_unknown_league(league_name, "is_valid_season_format")
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