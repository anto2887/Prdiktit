import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models import GroupAuditLog, MembershipStatus, PendingMembership

from ..models import (
    Group, GroupPrivacyType, MemberRole, MembershipStatus,
    User, group_members, TeamTracker, PendingMembership, Team
)

async def get_user_groups(db: Session, user_id: int) -> List[Group]:
    """
    Get all groups a user is a member of
    """
    # Query all groups where user is a member through group_members table
    query = db.query(Group).join(
        group_members,
        Group.id == group_members.c.group_id
    ).filter(
        group_members.c.user_id == user_id
    )
    
    return query.all()

async def get_group_by_id(db: Session, group_id: int) -> Optional[Group]:
    """
    Get group by ID
    """
    return db.query(Group).filter(Group.id == group_id).first()

async def get_group_by_invite_code(db: Session, invite_code: str) -> Optional[Group]:
    """
    Get group by invite code
    """
    return db.query(Group).filter(Group.invite_code == invite_code).first()

async def create_group(db: Session, admin_id: int, **group_data) -> Group:
    """
    Create a new group
    """
    # Extract tracked_teams if present
    tracked_teams = group_data.pop('tracked_teams', None)
    
    # Generate a random invite code if not provided
    if 'invite_code' not in group_data:
        group_data['invite_code'] = str(uuid.uuid4())[:8].upper()
    
    # Create the group
    group = Group(
        admin_id=admin_id,
        created=datetime.now(timezone.utc),
        **group_data
    )
    
    db.add(group)
    db.flush()  # Flush to get the group ID without committing transaction
    
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
            # Verify team exists
            team = db.query(Team).filter(Team.id == team_id).first()
            if team:
                team_tracker = TeamTracker(
                    group_id=group.id,
                    team_id=team_id,
                    added_at=datetime.now(timezone.utc)
                )
                db.add(team_tracker)
    
    # Commit the transaction
    db.commit()
    db.refresh(group)
    
    return group

async def update_group(db: Session, group_id: int, **group_data) -> Optional[Group]:
    """
    Update an existing group
    """
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    
    # Extract tracked_teams if present
    tracked_teams = group_data.pop('tracked_teams', None)
    
    # Update group attributes
    for key, value in group_data.items():
        setattr(group, key, value)
    
    # Update tracked teams if provided
    if tracked_teams is not None:
        # Remove existing tracked teams
        db.query(TeamTracker).filter(TeamTracker.group_id == group_id).delete()
        
        # Add new tracked teams
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

async def regenerate_invite_code(db: Session, group_id: int) -> Optional[str]:
    """
    Regenerate a group's invite code
    """
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    
    # Generate a new invite code
    new_code = str(uuid.uuid4())[:8].upper()
    group.invite_code = new_code
    
    db.commit()
    return new_code

async def get_group_members(db: Session, group_id: int) -> List[Dict]:
    """
    Get all members of a group
    """
    # Query the group_members association table with user details
    query = db.query(
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
    for row in query:
        members.append({
            'user_id': row.user_id,
            'username': row.username,
            'role': row.role,
            'joined_at': row.joined_at,
            'last_active': row.last_active
        })
    
    # Also get pending membership requests
    pending_query = db.query(
        PendingMembership,
        User.username.label('username')
    ).join(
        User,
        PendingMembership.user_id == User.id
    ).filter(
        PendingMembership.group_id == group_id,
        PendingMembership.status == MembershipStatus.PENDING
    )
    
    for row in pending_query:
        members.append({
            'user_id': row.PendingMembership.user_id,
            'username': row.username,
            'role': MemberRole.MEMBER,
            'status': MembershipStatus.PENDING,
            'requested_at': row.PendingMembership.requested_at
        })
    
    return members

async def check_group_membership(db: Session, group_id: int, user_id: int) -> bool:
    """
    Check if a user is a member of a group
    """
    result = db.query(group_members).filter(
        group_members.c.group_id == group_id,
        group_members.c.user_id == user_id
    ).first()
    
    return result is not None

async def get_user_role_in_group(db: Session, group_id: int, user_id: int) -> Optional[MemberRole]:
    """
    Get a user's role in a group
    """
    result = db.query(group_members.c.role).filter(
        group_members.c.group_id == group_id,
        group_members.c.user_id == user_id
    ).first()
    
    return result[0] if result else None

async def get_group_tracked_teams(db: Session, group_id: int) -> List[int]:
    """
    Get IDs of teams tracked by a group
    """
    query = db.query(TeamTracker.team_id).filter(TeamTracker.group_id == group_id)
    return [row[0] for row in query]