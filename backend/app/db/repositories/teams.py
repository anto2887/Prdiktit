# backend/app/db/repositories/teams.py
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models import Team

async def get_team_by_id(db: Session, team_id: int) -> Optional[Team]:
    """
    Get team by ID
    """
    return db.query(Team).filter(Team.id == team_id).first()

async def get_team_by_external_id(db: Session, external_id: int) -> Optional[Team]:
    """
    Get team by external ID (from football API)
    """
    return db.query(Team).filter(Team.team_id == external_id).first()

async def get_teams_by_league(db: Session, league: str) -> List[Team]:
    """
    Get teams for a specific league name or league ID
    """
    try:
        # Try to convert to an integer (in case we have a league ID)
        league_id = int(league)
        return db.query(Team).filter(Team.league_id == league_id).all()
    except (ValueError, TypeError):
        # If not a number, it's probably a league name
        # First, handle potential mapping from frontend to DB values
        league_mapping = {
            "Premier League": 39,
            "La Liga": 140,
            "UEFA Champions League": 2
        }
        
        # If the league is in our mapping, filter by league_id
        if league in league_mapping:
            league_id = league_mapping[league]
            return db.query(Team).filter(Team.league_id == league_id).all()
        else:
            # Try to match by country, which might be storing the league name in some cases
            return db.query(Team).filter(Team.country == league).all()
    except Exception as e:
        # Log any other errors
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_teams_by_league: {str(e)}")
        return []

async def get_teams_by_league_id(db: Session, league_id: int) -> List[Team]:
    """
    Get teams for a specific league by league ID
    """
    return db.query(Team).filter(Team.league_id == league_id).all()

async def create_team(db: Session, team_data: dict) -> Team:
    """
    Create a new team
    """
    team = Team(**team_data)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

async def update_team(db: Session, team_id: int, team_data: dict) -> Optional[Team]:
    """
    Update an existing team
    """
    team = await get_team_by_id(db, team_id)
    if not team:
        return None
        
    for key, value in team_data.items():
        setattr(team, key, value)
        
    db.commit()
    db.refresh(team)
    return team

async def create_or_update_team(db: Session, team_data: dict) -> Team:
    """
    Create or update a team based on team_id
    """
    # Check if team already exists
    team = await get_team_by_external_id(db, team_data["team_id"])
    
    if team:
        # Update existing team
        for key, value in team_data.items():
            setattr(team, key, value)
    else:
        # Create new team
        team = Team(**team_data)
        db.add(team)
    
    db.commit()
    db.refresh(team)
    return team