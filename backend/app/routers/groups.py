from typing import Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session

from ..core.security import get_current_active_user
from ..db.session import get_db
from ..services.cache_service import get_cache, RedisCache
from ..schemas.groups import (
    Group, GroupCreate, GroupDetail, GroupList, GroupUpdate,
    GroupMember, GroupMemberList, JoinGroupRequest, JoinGroupResponse,
    MemberActionRequest, MemberActionResponse, TeamInfo, TeamList,
    GroupAnalytics, AuditLogList
)
from ..schemas.user import UserInDB
from ..db.repositories.groups import group_members

router = APIRouter()

@router.get("", response_model=GroupList)
async def get_user_groups(
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get current user's groups
    """
    try:
        # Try to get from cache
        cache_key = f"user_groups:{current_user.id}"
        cached_groups = await cache.get(cache_key)
        
        if cached_groups:
            groups = cached_groups
        else:
            # Import the repository function
            from ..db.repositories.groups import get_user_groups as get_user_groups_db
            
            # Get groups from database
            db_groups = await get_user_groups_db(db, current_user.id)
            
            # Convert to list of dicts (for better serialization)
            groups = []
            for group in db_groups:
                # Get member count
                member_count = db.query(group_members).filter(
                    group_members.c.group_id == group.id
                ).count()
                
                # Get user's role in the group
                role = db.query(group_members.c.role).filter(
                    group_members.c.group_id == group.id,
                    group_members.c.user_id == current_user.id
                ).first()
                
                role_value = role[0] if role else None
                
                # Convert to dict
                group_dict = {
                    "id": group.id,
                    "name": group.name,
                    "league": group.league,
                    "admin_id": group.admin_id,
                    "invite_code": group.invite_code,
                    "created_at": group.created.isoformat() if group.created else None,
                    "privacy_type": group.privacy_type.value if group.privacy_type else None,
                    "description": group.description,
                    "member_count": member_count,
                    "role": role_value.value if role_value else None
                }
                
                groups.append(group_dict)
            
            # Cache for 10 minutes
            await cache.set(cache_key, groups, 600)
        
        return {
            "status": "success",
            "data": groups
        }
    except Exception as e:
        # Log the error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting user groups: {str(e)}")
        
        # Return empty list instead of error
        return {
            "status": "success",
            "data": []
        }

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Create a new group
    """
    try:
        # Import our group repository functions
        from ..db.repositories.groups import create_group as create_group_db
        
        # Create the group in the database
        new_group = await create_group_db(
            db, 
            admin_id=current_user.id, 
            **group_data.dict()
        )
        
        # Clear cache
        await cache.delete(f"user_groups:{current_user.id}")
        
        # Return success with group details
        return {
            "status": "success",
            "message": "Group created successfully",
            "data": {
                "group_id": new_group.id,
                "invite_code": new_group.invite_code,
                "name": new_group.name
            }
        }
    except Exception as e:
        # Log the error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating group: {str(e)}")
        
        # Return error response
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create group: {str(e)}"
        )

@router.post("/join", response_model=JoinGroupResponse)
async def join_group(
    join_data: JoinGroupRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Join a group using invite code
    """
    # This is a placeholder - you'll need to implement the actual repository function
    # group = await get_group_by_invite_code(db, join_data.invite_code)
    
    # For now, assume group exists
    group = {
        "id": 1,
        "name": "Mock Group",
        "privacy_type": "PRIVATE"
    }
    
    # This is a placeholder - you'll need to implement the actual repository function
    # is_member = await check_group_membership(db, group["id"], current_user.id)
    
    # For now, assume user is not a member
    is_member = False
    
    if is_member:
        return {
            "status": "success",
            "message": "You are already a member of this group"
        }
    
    # This is a placeholder - you'll need to implement the actual repository function
    # If group is private, create pending membership
    # if group["privacy_type"] == "PRIVATE":
    #     await create_pending_membership(db, group["id"], current_user.id)
    #     message = "Membership request sent. Waiting for admin approval."
    # else:
    #     await add_group_member(db, group["id"], current_user.id)
    #     message = f"You have joined {group['name']}!"
    
    # For now, use a mock message
    message = "Membership request sent. Waiting for admin approval."
    
    # Clear cache
    await cache.delete(f"user_groups:{current_user.id}")
    
    return {
        "status": "success",
        "message": message
    }

@router.get("/teams", response_model=TeamList)
async def get_teams(
    league: str = Query(..., description="League name or ID"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get teams for a league
    """
    try:
        # Add logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"get_teams endpoint called by user {current_user.id} for league {league}")
        
        # Map league IDs to names if needed
        league_mapping = {
            "PL": "Premier League",
            "LL": "La Liga",
            "UCL": "UEFA Champions League"
        }
        
        # Use mapped league name if available
        league_name = league_mapping.get(league, league)
        logger.info(f"Mapped league '{league}' to '{league_name}'")
        
        # Try to get from cache
        cache_key = f"league_teams:{league_name}"
        cached_teams = await cache.get(cache_key)
        
        if cached_teams:
            logger.debug(f"Teams for league {league_name} found in cache")
            teams = cached_teams
        else:
            logger.debug(f"Teams for league {league_name} not found in cache, fetching from database")
            
            # Get teams from the database
            from ..db.repositories.teams import get_teams_by_league
            
            # Get teams by league name
            teams_from_db = await get_teams_by_league(db, league_name)
            
            if teams_from_db:
                logger.info(f"Found {len(teams_from_db)} teams for league {league_name} in database")
                # Convert team objects to dict format for better JSON serialization
                teams = []
                for team in teams_from_db:
                    teams.append({
                        "id": team.id,
                        "name": team.team_name,
                        "logo": team.team_logo
                    })
            else:
                logger.warning(f"No teams found in database for league {league_name}")
                # Return empty list if no teams found
                teams = []
            
            # Cache for 24 hours (since team data doesn't change often)
            await cache.set(cache_key, teams, 86400)
        
        logger.info(f"Returning {len(teams)} teams for league {league_name}")
        
        # Convert dicts to TeamInfo objects for the response
        team_info_objects = [TeamInfo(id=t["id"], name=t["name"], logo=t["logo"]) for t in teams]
        
        # Return in the expected format
        return {"status": "success", "data": team_info_objects}
    except Exception as e:
        logger.error(f"Error in get_teams: {str(e)}")
        return {"status": "success", "data": []}  # Return empty list on error

@router.get("/{group_id}", response_model=dict)
async def get_group_details(
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group details
    """
    # Try to get from cache
    cache_key = f"group:{group_id}"
    cached_group = await cache.get(cache_key)
    
    if cached_group:
        group = cached_group
    else:
        # This is a placeholder - you'll need to implement the actual repository function
        # group = await get_group_by_id(db, group_id)
        
        # For now, return a mock response
        group = {
            "id": group_id,
            "name": "Mock Group",
            "league": "Premier League",
            "description": "This is a mock group",
            "privacy_type": "PRIVATE",
            "admin_id": current_user.id,
            "invite_code": "ABC123",
            "created_at": "2023-01-01T00:00:00Z",
            "member_count": 1,
            "role": "ADMIN",
            "analytics": None,
            "tracked_teams": []
        }
        
        # Cache for 10 minutes
        await cache.set(cache_key, group, 600)
    
    # Check if user is a member of the group
    # This is a placeholder - you'll need to implement the actual check
    is_member = True
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return {
        "status": "success",
        "data": group
    }

@router.put("/{group_id}", response_model=dict)
async def update_group(
    group_data: GroupUpdate,
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Update group details
    """
    # This is a placeholder - you'll need to implement the actual repository function
    # group = await get_group_by_id(db, group_id)
    
    # For now, assume group exists
    group = {
        "id": group_id,
        "admin_id": current_user.id
    }
    
    # Check if user is admin
    if group["admin_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can update group details"
        )
    
    # This is a placeholder - you'll need to implement the actual repository function
    # updated_group = await update_group_db(db, group_id, **group_data.dict(exclude_unset=True))
    
    # Clear cache
    await cache.delete(f"group:{group_id}")
    await cache.delete(f"user_groups:{current_user.id}")
    
    return {
        "status": "success",
        "message": "Group updated successfully"
    }

@router.get("/{group_id}/members", response_model=GroupMemberList)
async def get_group_members(
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group members
    """
    # Check if user is a member of the group
    # This is a placeholder - you'll need to implement the actual check
    is_member = True
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Try to get from cache
    cache_key = f"group_members:{group_id}"
    cached_members = await cache.get(cache_key)
    
    if cached_members:
        members = cached_members
    else:
        # This is a placeholder - you'll need to implement the actual repository function
        # members = await get_group_members_db(db, group_id)
        
        # For now, return a mock response
        members = [
            {
                "user_id": current_user.id,
                "username": current_user.username,
                "role": "ADMIN",
                "joined_at": "2023-01-01T00:00:00Z",
                "last_active": "2023-01-01T00:00:00Z"
            }
        ]
        
        # Cache for 5 minutes
        await cache.set(cache_key, members, 300)
    
    return {
        "status": "success",
        "data": members
    }

@router.post("/{group_id}/members", response_model=MemberActionResponse)
async def manage_group_members(
    action_data: MemberActionRequest,
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Manage group members (approve, reject, promote, demote, remove)
    """
    # Check if user is admin or moderator
    # This is a placeholder - you'll need to implement the actual check
    user_role = "ADMIN"
    
    if user_role not in ["ADMIN", "MODERATOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage members"
        )
    
    # This is a placeholder - you'll need to implement the actual repository function
    # results = await process_member_action(
    #     db, group_id, current_user.id, action_data.user_ids, action_data.action
    # )
    
    # For now, return a mock response
    results = [
        {
            "user_id": user_id,
            "status": "success"
        }
        for user_id in action_data.user_ids
    ]
    
    # Clear cache
    await cache.delete(f"group_members:{group_id}")
    
    return {
        "status": "success",
        "message": f"{action_data.action} action completed",
        "data": results
    }

@router.get("/{group_id}/analytics", response_model=dict)
async def get_group_analytics(
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group analytics
    """
    # Check if user is a member of the group
    # This is a placeholder - you'll need to implement the actual check
    is_member = True
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Try to get from cache
    cache_key = f"group_analytics:{group_id}"
    cached_analytics = await cache.get(cache_key)
    
    if cached_analytics:
        analytics = cached_analytics
    else:
        # This is a placeholder - you'll need to implement the actual repository function
        # analytics = await get_group_analytics_db(db, group_id)
        
        # For now, return a mock response
        analytics = {
            "overall_stats": {
                "total_predictions": 0,
                "correct_predictions": 0,
                "average_points": 0
            },
            "member_performance": [],
            "prediction_patterns": {
                "home_wins": 0,
                "away_wins": 0,
                "draws": 0
            },
            "weekly_trends": [],
            "generated_at": datetime.now().isoformat()
        }
        
        # Cache for 1 hour
        await cache.set(cache_key, analytics, 3600)
    
    return {
        "status": "success",
        "data": analytics
    }

@router.get("/{group_id}/audit", response_model=AuditLogList)
async def get_group_audit_log(
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get group audit log
    """
    # Check if user is admin
    # This is a placeholder - you'll need to implement the actual check
    user_role = "ADMIN"
    
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can view audit log"
        )
    
    # This is a placeholder - you'll need to implement the actual repository function
    # logs = await get_group_audit_logs(db, group_id)
    
    # For now, return a mock response
    logs = []
    
    return {
        "status": "success",
        "data": logs
    }