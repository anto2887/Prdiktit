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
    Get teams for a specific league name
    """
    return db.query(Team).filter(Team.country == league).all()

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