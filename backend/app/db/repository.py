# backend/app/db/repository.py
"""
Consolidated repository module for all database operations.
This replaces the separate repository files to reduce code duplication
and improve maintainability.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case, literal, union, select

from .models import (
    User, Group, Fixture, UserPrediction, Team, TeamTracker, 
    PendingMembership, UserResults, GroupAuditLog,
    MatchStatus, PredictionStatus, GroupPrivacyType, 
    MemberRole, MembershipStatus, group_members
)

import logging

logger = logging.getLogger(__name__)

# =============================================================================
# USER REPOSITORY FUNCTIONS
# =============================================================================

async def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()

async def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get user by username"""
    return db.query(User).filter(User.username == username).first()

async def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email"""
    return db.query(User).filter(User.email == email).first()

async def create_user(db: Session, **user_data) -> User:
    """Create a new user"""
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

async def update_user(db: Session, user_id: int, **user_data) -> Optional[User]:
    """Update user"""
    user = await get_user_by_id(db, user_id)
    if not user:
        return None
        
    for key, value in user_data.items():
        setattr(user, key, value)
        
    db.commit()
    db.refresh(user)
    return user

async def delete_user(db: Session, user_id: int) -> bool:
    """Delete user"""
    user = await get_user_by_id(db, user_id)
    if not user:
        return False
        
    db.delete(user)
    db.commit()
    return True

async def get_user_stats(db: Session, user_id: int) -> dict:
    """Get user statistics"""
    try:
        # Get total points
        total_points_result = db.query(
            func.sum(UserPrediction.points)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).scalar()
        
        total_points = int(total_points_result or 0)

        # Get basic prediction stats
        total_predictions_result = db.query(
            func.count(UserPrediction.id)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).scalar()
        
        total_predictions = int(total_predictions_result or 0)
        
        # Get perfect predictions (3 points) count
        perfect_predictions_result = db.query(
            func.count(UserPrediction.id)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED,
            UserPrediction.points == 3
        ).scalar()
        
        perfect_predictions = int(perfect_predictions_result or 0)
        
        # Calculate average points
        average_points = 0.0
        if total_predictions > 0:
            average_points = total_points / total_predictions

        return {
            "total_points": total_points,
            "total_predictions": total_predictions,
            "perfect_predictions": perfect_predictions,
            "average_points": round(average_points, 2)
        }
        
    except Exception as e:
        logger.error(f"Error fetching user stats for user {user_id}: {str(e)}")
        return {
            "total_points": 0,
            "total_predictions": 0,
            "perfect_predictions": 0,
            "average_points": 0.0
        }

# =============================================================================
# MATCH/FIXTURE REPOSITORY FUNCTIONS
# =============================================================================

async def get_fixture_by_id(db: Session, fixture_id: int) -> Optional[Fixture]:
    """Get fixture by ID"""
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
    """Get fixtures with filters"""
    query = db.query(Fixture)
    
    if league:
        query = query.filter(Fixture.league == league)
    
    if season:
        query = query.filter(Fixture.season == season)
    
    if status:
        if isinstance(status, str):
            try:
                status = MatchStatus(status)
            except (ValueError, KeyError):
                pass
        
        if isinstance(status, MatchStatus):
            query = query.filter(Fixture.status == status)
    
    if from_date:
        query = query.filter(Fixture.date >= from_date)
    
    if to_date:
        query = query.filter(Fixture.date <= to_date)
    
    if team_id:
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
    """Get all live matches"""
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

async def create_or_update_fixture(db: Session, **fixture_data) -> Fixture:
    """
    Create a new fixture or update existing one
    
    Args:
        db: Database session
        **fixture_data: Fixture data fields
        
    Returns:
        Created or updated Fixture object
    """
    try:
        fixture_id = fixture_data.get('fixture_id')
        
        if not fixture_id:
            raise ValueError("fixture_id is required")
        
        # Check if fixture already exists
        existing_fixture = db.query(Fixture).filter(
            Fixture.fixture_id == fixture_id
        ).first()
        
        if existing_fixture:
            # Update existing fixture
            for key, value in fixture_data.items():
                if hasattr(existing_fixture, key) and value is not None:
                    setattr(existing_fixture, key, value)
            
            existing_fixture.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing_fixture)
            return existing_fixture
        else:
            # Create new fixture
            new_fixture = Fixture(
                **fixture_data,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            db.add(new_fixture)
            db.commit()
            db.refresh(new_fixture)
            return new_fixture
            
    except Exception as e:
        logger.error(f"Error creating/updating fixture {fixture_data.get('fixture_id')}: {e}")
        db.rollback()
        raise

async def get_prediction_deadlines(db: Session) -> Dict[str, str]:
    """
    Get prediction deadlines for upcoming fixtures.
    
    TIMEZONE HANDLING:
    - Returns UTC timestamps as ISO strings
    - Frontend converts to user's local timezone
    - Deadline is exactly the kickoff time (no buffer)
    """
    deadlines = {}
    
    # Get upcoming fixtures with UTC-aware comparison
    current_time_utc = datetime.now(timezone.utc)
    
    fixtures = db.query(Fixture).filter(
        Fixture.status == MatchStatus.NOT_STARTED,
        Fixture.date > current_time_utc
    ).all()
    
    for fixture in fixtures:
        if fixture.date:
            # Ensure UTC timezone info
            if fixture.date.tzinfo is None:
                deadline_utc = fixture.date.replace(tzinfo=timezone.utc)
            else:
                deadline_utc = fixture.date.astimezone(timezone.utc)
            
            # Return as ISO string with timezone info
            deadlines[str(fixture.fixture_id)] = deadline_utc.isoformat()
    
    return deadlines

async def get_fixtures_needing_update(db: Session, hours_ago: int = 24) -> List[Fixture]:
    """
    Get fixtures that might need updates (recent or upcoming)
    
    Args:
        db: Database session
        hours_ago: How many hours back to check
        
    Returns:
        List of fixtures that might need updates
    """
    try:
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        future_time = datetime.now(timezone.utc) + timedelta(days=7)
        
        fixtures = db.query(Fixture).filter(
            Fixture.date >= cutoff_time,
            Fixture.date <= future_time,
            ~Fixture.status.in_([
                MatchStatus.CANCELLED,
                MatchStatus.ABANDONED
            ])
        ).order_by(Fixture.date.asc()).all()
        
        return fixtures
        
    except Exception as e:
        logger.error(f"Error getting fixtures needing update: {e}")
        return []

async def bulk_update_fixtures(db: Session, fixtures_data: List[Dict]) -> Dict[str, int]:
    """
    Bulk update multiple fixtures efficiently
    
    Args:
        db: Database session
        fixtures_data: List of fixture data dictionaries
        
    Returns:
        Dictionary with update statistics
    """
    stats = {"updated": 0, "created": 0, "errors": 0}
    
    try:
        for fixture_data in fixtures_data:
            try:
                await create_or_update_fixture(db, **fixture_data)
                
                # Determine if it was an update or creation
                fixture_id = fixture_data.get('fixture_id')
                existing = db.query(Fixture).filter(
                    Fixture.fixture_id == fixture_id
                ).first()
                
                if existing:
                    # Check if it was recently created (within last minute)
                    if existing.created_at and (datetime.now(timezone.utc) - existing.created_at).total_seconds() < 60:
                        stats["created"] += 1
                    else:
                        stats["updated"] += 1
                        
            except Exception as e:
                logger.error(f"Error in bulk update for fixture {fixture_data.get('fixture_id')}: {e}")
                stats["errors"] += 1
                continue
        
        return stats
        
    except Exception as e:
        logger.error(f"Error in bulk_update_fixtures: {e}")
        return stats

async def get_fixtures_by_status_and_date(
    db: Session, 
    status: MatchStatus,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> List[Fixture]:
    """
    Get fixtures by status within a date range
    
    Args:
        db: Database session
        status: Match status to filter by
        date_from: Start date (optional)
        date_to: End date (optional)
        
    Returns:
        List of matching fixtures
    """
    try:
        query = db.query(Fixture).filter(Fixture.status == status)
        
        if date_from:
            query = query.filter(Fixture.date >= date_from)
            
        if date_to:
            query = query.filter(Fixture.date <= date_to)
            
        fixtures = query.order_by(Fixture.date.asc()).all()
        return fixtures
        
    except Exception as e:
        logger.error(f"Error getting fixtures by status and date: {e}")
        return []

async def mark_fixtures_for_monitoring(db: Session, fixture_ids: List[int]) -> int:
    """
    Mark fixtures as needing monitoring (for enhanced scheduler)
    
    Args:
        db: Database session
        fixture_ids: List of fixture IDs to mark
        
    Returns:
        Number of fixtures marked
    """
    try:
        marked = 0
        
        for fixture_id in fixture_ids:
            fixture = db.query(Fixture).filter(
                Fixture.fixture_id == fixture_id
            ).first()
            
            if fixture:
                # Add a monitoring flag or timestamp
                fixture.needs_monitoring = True
                fixture.last_monitored = datetime.now(timezone.utc)
                marked += 1
        
        db.commit()
        return marked
        
    except Exception as e:
        logger.error(f"Error marking fixtures for monitoring: {e}")
        db.rollback()
        return 0

# =============================================================================
# PREDICTION REPOSITORY FUNCTIONS
# =============================================================================

async def get_prediction_by_id(db: Session, prediction_id: int) -> Optional[UserPrediction]:
    """Get prediction by ID"""
    return db.query(UserPrediction).filter(UserPrediction.id == prediction_id).first()

async def get_user_prediction(
    db: Session, 
    user_id: int, 
    fixture_id: int
) -> Optional[UserPrediction]:
    """Get user's prediction for a fixture"""
    return db.query(UserPrediction).filter(
        UserPrediction.user_id == user_id,
        UserPrediction.fixture_id == fixture_id
    ).first()

async def get_user_predictions(
    db: Session, 
    user_id: int,
    fixture_id: Optional[int] = None,
    status: Optional[Union[PredictionStatus, str]] = None,
    season: Optional[str] = None,
    week: Optional[int] = None
) -> List[UserPrediction]:
    """Get user predictions with filters"""
    query = db.query(UserPrediction).filter(UserPrediction.user_id == user_id)
    
    if fixture_id:
        query = query.filter(UserPrediction.fixture_id == fixture_id)
    
    if status:
        if isinstance(status, str):
            try:
                status = PredictionStatus(status)
            except (ValueError, KeyError):
                pass
                
        if isinstance(status, PredictionStatus):
            query = query.filter(UserPrediction.prediction_status == status)
    
    if season:
        query = query.filter(UserPrediction.season == season)
    
    if week:
        query = query.filter(UserPrediction.week == week)
        
    return query.order_by(UserPrediction.created.desc()).all()

async def create_prediction(db: Session, user_id: int, fixture_id: int, 
                          score1: int, score2: int, season: str, week: int, **kwargs) -> UserPrediction:
    """
    Create a new prediction.
    
    TIMEZONE HANDLING:
    - All timestamps stored as UTC in database
    """
    prediction = UserPrediction(
        user_id=user_id,
        fixture_id=fixture_id,
        score1=score1,
        score2=score2,
        season=season,
        week=week,
        prediction_status=PredictionStatus.EDITABLE,
        # FIXED: Use timezone-aware UTC
        submission_time=datetime.now(timezone.utc),
        last_modified=datetime.now(timezone.utc),
        **kwargs
    )
    
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction

async def update_prediction(
    db: Session, 
    prediction_id: int, 
    score1: Optional[int] = None,
    score2: Optional[int] = None
) -> Optional[UserPrediction]:
    """Update an existing prediction with timezone handling"""
    
    prediction = await get_prediction_by_id(db, prediction_id)
    
    if not prediction:
        return None
        
    if prediction.prediction_status not in [PredictionStatus.EDITABLE, PredictionStatus.SUBMITTED]:
        return None
        
    if score1 is not None:
        prediction.score1 = score1
        
    if score2 is not None:
        prediction.score2 = score2
        
    prediction.prediction_status = PredictionStatus.SUBMITTED
    
    # Update with timezone-aware datetime
    prediction.submission_time = datetime.now(timezone.utc)
    prediction.last_modified = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(prediction)
    return prediction

async def reset_prediction(db: Session, prediction_id: int) -> Optional[UserPrediction]:
    """Reset a prediction to editable state"""
    prediction = await get_prediction_by_id(db, prediction_id)
    
    if not prediction:
        return None
        
    if prediction.prediction_status != PredictionStatus.SUBMITTED:
        return None
        
    prediction.prediction_status = PredictionStatus.EDITABLE
    prediction.last_modified = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(prediction)
    return prediction

def calculate_points(
    pred_home: int, 
    pred_away: int, 
    actual_home: int, 
    actual_away: int
) -> int:
    """Calculate points for a prediction"""
    # Exact score match
    if pred_home == actual_home and pred_away == actual_away:
        return 3
        
    # Correct result
    pred_result = pred_home - pred_away
    actual_result = actual_home - actual_away
    
    if (pred_result > 0 and actual_result > 0) or \
       (pred_result < 0 and actual_result < 0) or \
       (pred_result == 0 and actual_result == 0):
        return 1
        
    return 0

# =============================================================================
# TEAM REPOSITORY FUNCTIONS
# =============================================================================

async def get_team_by_id(db: Session, team_id: int) -> Optional[Team]:
    """Get team by ID"""
    return db.query(Team).filter(Team.id == team_id).first()

async def get_team_by_external_id(db: Session, external_id: int) -> Optional[Team]:
    """Get team by external ID (from football API)"""
    return db.query(Team).filter(Team.team_id == external_id).first()

async def get_teams_by_league(db: Session, league: str) -> List[Team]:
    """Get teams for a specific league name or league ID"""
    try:
        # Try to convert to an integer (in case we have a league ID)
        league_id = int(league)
        return db.query(Team).filter(Team.league_id == league_id).all()
    except (ValueError, TypeError):
        # If not a number, it's probably a league name
        league_mapping = {
            "Premier League": {"id": 39, "season": 2024},
            "La Liga": {"id": 140, "season": 2024},
            "UEFA Champions League": {"id": 2, "season": 2024},
            "MLS": {"id": 253, "season": 2025},
            "FIFA Club World Cup": {"id": 15, "season": 2025}
        }
        
        if league in league_mapping:
            league_config = league_mapping[league]
            league_id = league_config['id']
            return db.query(Team).filter(Team.league_id == league_id).all()
        else:
            return db.query(Team).filter(Team.country == league).all()
    except Exception as e:
        logger.error(f"Error in get_teams_by_league: {str(e)}")
        return []

async def create_or_update_team(db: Session, team_data: dict) -> Team:
    """Create or update a team based on team_id"""
    team = await get_team_by_external_id(db, team_data["team_id"])
    
    if team:
        for key, value in team_data.items():
            setattr(team, key, value)
    else:
        team = Team(**team_data)
        db.add(team)
    
    db.commit()
    db.refresh(team)
    return team

async def create_team(db: Session, team_data: dict) -> Team:
    """Create a new team"""
    team = Team(**team_data)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

async def update_team(db: Session, team_id: int, team_data: dict) -> Optional[Team]:
    """Update an existing team"""
    team = await get_team_by_id(db, team_id)
    if not team:
        return None
        
    for key, value in team_data.items():
        setattr(team, key, value)
        
    db.commit()
    db.refresh(team)
    return team

# =============================================================================
# GROUP REPOSITORY FUNCTIONS
# =============================================================================

async def get_user_groups(db: Session, user_id: int) -> List[Group]:
    """Get all groups a user is a member of or is an admin of"""
    try:
        logger.info(f"Getting groups for user {user_id}")
        
        # Get all groups where user is admin - SIMPLE QUERY
        admin_groups = db.query(Group).filter(Group.admin_id == user_id).all()
        logger.info(f"Found {len(admin_groups)} admin groups for user {user_id}")
        
        # Get all groups where user is a member - SIMPLE QUERY  
        member_groups = db.query(Group).join(
            group_members,
            Group.id == group_members.c.group_id
        ).filter(
            group_members.c.user_id == user_id
        ).all()
        logger.info(f"Found {len(member_groups)} member groups for user {user_id}")
        
        # Combine both lists and remove duplicates using a dict
        all_groups = {}
        
        # Add admin groups
        for group in admin_groups:
            logger.info(f"Adding admin group: {group.id} - {group.name}")
            all_groups[group.id] = group
            
        # Add member groups (won't duplicate if user is admin)
        for group in member_groups:
            if group.id not in all_groups:
                logger.info(f"Adding member group: {group.id} - {group.name}")
                all_groups[group.id] = group
            else:
                logger.info(f"Skipping duplicate group: {group.id} - {group.name}")
        
        result = list(all_groups.values())
        logger.info(f"Final result: {len(result)} groups for user {user_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error in get_user_groups for user {user_id}: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return []

async def get_group_by_id(db: Session, group_id: int) -> Optional[Group]:
    """Get group by ID"""
    return db.query(Group).filter(Group.id == group_id).first()

async def get_group_by_invite_code(db: Session, invite_code: str) -> Optional[Group]:
    """Get group by invite code"""
    return db.query(Group).filter(Group.invite_code == invite_code).first()

async def create_group(db: Session, admin_id: int, **group_data) -> Group:
    """Create a new group"""
    try:
        tracked_teams = group_data.pop('tracked_teams', None)
        
        if 'invite_code' not in group_data:
            group_data['invite_code'] = str(uuid.uuid4())[:8].upper()
        
        group = Group(
            admin_id=admin_id,
            created=datetime.now(timezone.utc),
            **group_data
        )
        
        db.add(group)
        db.flush()
        
        # Add admin as a member with ADMIN role
        stmt = group_members.insert().values(
            user_id=admin_id,
            group_id=group.id,
            role=MemberRole.ADMIN,
            joined_at=datetime.now(timezone.utc),
            last_active=datetime.now(timezone.utc)
        )
        db.execute(stmt)
        
        # Add tracked teams if provided
        if tracked_teams and isinstance(tracked_teams, list):
            for team_id in tracked_teams:
                team = db.query(Team).filter(Team.id == team_id).first()
                if team:
                    team_tracker = TeamTracker(
                        group_id=group.id,
                        team_id=team_id,
                        added_at=datetime.now(timezone.utc)
                    )
                    db.add(team_tracker)
        
        # Add audit log for group creation
        log_entry = GroupAuditLog(
            group_id=group.id,
            user_id=admin_id,
            action="Group created",
            details={"group_name": group.name, "league": group.league},
            created_at=datetime.now(timezone.utc)
        )
        db.add(log_entry)
        
        db.commit()
        db.refresh(group)
        return group
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group: {e}")
        raise

async def regenerate_invite_code(db: Session, group_id: int) -> Optional[str]:
    """Regenerate a group's invite code"""
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    
    new_code = str(uuid.uuid4())[:8].upper()
    group.invite_code = new_code
    
    db.commit()
    return new_code

async def get_group_members(db: Session, group_id: int) -> List[Dict]:
    """Get all members of a group including pending members"""
    logger.info(f"get_group_members called for group_id: {group_id}")
    
    # FIXED: Get approved members with proper query
    approved_query = db.query(
        User.id.label('user_id'),
        User.username.label('username'),
        group_members.c.role.label('role'),
        group_members.c.joined_at.label('joined_at'),
        group_members.c.last_active.label('last_active')
    ).join(
        group_members,
        User.id == group_members.c.user_id
    ).filter(
        group_members.c.group_id == group_id
    )
    
    members = []
    for row in approved_query:
        member_data = {
            'user_id': row.user_id,
            'username': row.username,
            'role': row.role.value if hasattr(row.role, 'value') else str(row.role),
            'joined_at': row.joined_at,
            'last_active': row.last_active,
            'status': 'APPROVED'
        }
        members.append(member_data)
        logger.debug(f"Added approved member: {member_data['username']} to group {group_id}")
    
    # Get pending membership requests
    pending_query = db.query(
        PendingMembership.user_id,
        PendingMembership.requested_at,
        User.username
    ).join(
        User,
        PendingMembership.user_id == User.id
    ).filter(
        PendingMembership.group_id == group_id,
        PendingMembership.status == MembershipStatus.PENDING
    )
    
    for row in pending_query:
        pending_data = {
            'user_id': row.user_id,
            'username': row.username,
            'role': MemberRole.MEMBER.value,
            'status': MembershipStatus.PENDING.value,
            'requested_at': row.requested_at,
            'joined_at': None,
            'last_active': None
        }
        members.append(pending_data)
        logger.debug(f"Added pending member: {pending_data['username']} to group {group_id}")
    
    logger.info(f"get_group_members returning {len(members)} members for group {group_id}")
    
    return members

async def check_group_membership(db: Session, group_id: int, user_id: int) -> bool:
    """Check if a user is a member of a group (including admin)"""
    # Check if user is admin
    group = db.query(Group).filter(Group.id == group_id).first()
    if group and group.admin_id == user_id:
        return True
    
    # Check group_members table
    result = db.query(group_members).filter(
        group_members.c.group_id == group_id,
        group_members.c.user_id == user_id
    ).first()
    
    return result is not None

async def get_user_role_in_group(db: Session, group_id: int, user_id: int) -> Optional[MemberRole]:
    """Get a user's role in a group"""
    # First check if user is the group admin
    group = db.query(Group).filter(Group.id == group_id).first()
    if group and group.admin_id == user_id:
        return MemberRole.ADMIN
    
    # Then check group_members table
    result = db.query(group_members.c.role).filter(
        group_members.c.group_id == group_id,
        group_members.c.user_id == user_id
    ).first()
    
    if result:
        return result[0]
    
    return None

async def get_group_tracked_teams(db: Session, group_id: int) -> List[int]:
    """Get IDs of teams tracked by a group"""
    query = db.query(TeamTracker.team_id).filter(TeamTracker.group_id == group_id)
    return [row[0] for row in query]

async def process_match_predictions(db: Session, fixture_id: int) -> int:
    """Process all predictions for a match and update points"""
    fixture = await get_fixture_by_id(db, fixture_id)
    
    if not fixture:
        return 0
        
    if fixture.status not in [MatchStatus.FINISHED, MatchStatus.FINISHED_AET, MatchStatus.FINISHED_PEN]:
        return 0
        
    predictions = db.query(UserPrediction).filter(
        UserPrediction.fixture_id == fixture_id,
        UserPrediction.prediction_status == PredictionStatus.LOCKED
    ).all()
    
    count = 0
    for prediction in predictions:
        points = calculate_points(
            prediction.score1,
            prediction.score2,
            fixture.home_score,
            fixture.away_score
        )
        
        prediction.points = points
        prediction.prediction_status = PredictionStatus.PROCESSED
        prediction.processed_at = datetime.now(timezone.utc)
        
        user_result = db.query(UserResults).filter(
            UserResults.user_id == prediction.user_id,
            UserResults.season == prediction.season
        ).first()
        
        if not user_result:
            user_result = UserResults(
                user_id=prediction.user_id,
                points=0,
                season=prediction.season,
                week=prediction.week
            )
            db.add(user_result)
            
        user_result.points += points
        count += 1
        
    db.commit()
    return count

async def lock_predictions_for_match(db: Session, fixture_id: int) -> int:
    """Lock all predictions for a match"""
    predictions = db.query(UserPrediction).filter(
        UserPrediction.fixture_id == fixture_id,
        UserPrediction.prediction_status == PredictionStatus.SUBMITTED
    ).all()
    
    count = 0
    for prediction in predictions:
        prediction.prediction_status = PredictionStatus.LOCKED
        count += 1
        
    db.commit()
    return count

async def update_group(db: Session, group_id: int, **group_data) -> Optional[Group]:
    """Update an existing group"""
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    
    tracked_teams = group_data.pop('tracked_teams', None)
    
    for key, value in group_data.items():
        setattr(group, key, value)
    
    if tracked_teams is not None:
        db.query(TeamTracker).filter(TeamTracker.group_id == group_id).delete()
        
        for team_id in tracked_teams:
            team = db.query(Team).filter(Team.id == team_id).first()
            if team:
                team_tracker = TeamTracker(
                    group_id=group_id,
                    team_id=team_id,
                    added_at=datetime.now(timezone.utc)
                )
                db.add(team_tracker)
    
    db.commit()
    db.refresh(group)
    return group