# app/db/repositories/fixtures.py
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models import Fixture, MatchStatus, Team

async def get_fixture_by_id(db: Session, fixture_id: int) -> Optional[Fixture]:
    """
    Get fixture by ID
    """
    return db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()

async def get_fixtures(
    db: Session, 
    league: Optional[str] = None,
    season: Optional[str] = None,
    status: Optional[Union[MatchStatus, str]] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    team_id: Optional[int] = None,
    limit: int = 100
) -> List[Fixture]:
    """
    Get fixtures with filters
    """
    query = db.query(Fixture)
    
    if league:
        query = query.filter(Fixture.league == league)
    
    if season:
        query = query.filter(Fixture.season == season)
    
    if status:
        # Convert string to enum if needed
        if isinstance(status, str):
            try:
                status = MatchStatus(status)
            except (ValueError, KeyError):
                # Invalid status, ignore
                pass
        
        if isinstance(status, MatchStatus):
            query = query.filter(Fixture.status == status)
    
    if from_date:
        query = query.filter(Fixture.date >= from_date)
    
    if to_date:
        query = query.filter(Fixture.date <= to_date)
    
    if team_id:
        # Query for fixtures where either home or away team is the requested team
        team = db.query(Team).filter(Team.id == team_id).first()
        if team:
            query = query.filter(
                or_(
                    Fixture.home_team == team.team_name,
                    Fixture.away_team == team.team_name
                )
            )
    
    return query.order_by(Fixture.date).limit(limit).all()

async def get_live_matches(db: Session) -> List[Fixture]:
    """
    Get all live matches
    """
    return db.query(Fixture).filter(
        Fixture.status.in_([
            MatchStatus.LIVE,
            MatchStatus.FIRST_HALF,
            MatchStatus.SECOND_HALF,
            MatchStatus.HALFTIME,
            MatchStatus.EXTRA_TIME,
            MatchStatus.PENALTY
        ])
    ).all()

async def create_or_update_fixture(db: Session, fixture_data: Dict[str, Any]) -> Fixture:
    """
    Create or update fixture
    """
    fixture = await get_fixture_by_id(db, fixture_data["fixture_id"])
    
    if fixture:
        # Update existing fixture
        for key, value in fixture_data.items():
            setattr(fixture, key, value)
    else:
        # Create new fixture
        fixture = Fixture(**fixture_data)
        db.add(fixture)
    
    db.commit()
    db.refresh(fixture)
    return fixture

async def get_prediction_deadlines(db: Session) -> Dict[str, str]:
    """
    Get prediction deadlines for upcoming fixtures
    """
    deadlines = {}
    fixtures = db.query(Fixture).filter(
        Fixture.status == MatchStatus.NOT_STARTED,
        Fixture.date > datetime.now(timezone.utc)
    ).all()
    
    for fixture in fixtures:
        # Assuming prediction deadline is 1 hour before match
        deadline = fixture.date - timedelta(hours=1)
        deadlines[str(fixture.fixture_id)] = deadline.isoformat()
        
    return deadlines