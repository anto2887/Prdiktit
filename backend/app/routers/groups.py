# app/routers/groups.py
from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..core.security import get_current_active_user
from ..db.database import get_db
from ..services.cache_service import get_cache, RedisCache
from ..db import (
    group_members, 
    get_group_by_id, 
    check_group_membership, 
    get_user_role_in_group, 
    get_group_tracked_teams,
    get_group_members,
    regenerate_invite_code,
    create_group,
    get_group_by_invite_code,
    get_teams_by_league,
    update_group
)
# Import the repository function with a different name to avoid conflict
from ..db.repository import get_user_groups as get_user_groups_from_db

from ..db.models import (
    PendingMembership,
    MembershipStatus,
    GroupAuditLog,
    Group as GroupModel
)
from ..schemas import (
    GroupCreate, GroupBase, GroupMember,
    GroupPrivacyType, MemberRole, LoginRequest,
    ListResponse, DataResponse, User, TeamInfo,
    MemberAction
)

router = APIRouter()

@router.get("", response_model=ListResponse)
async def get_user_groups_endpoint(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get current user's groups
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Try to get from cache
        cache_key = f"user_groups:{current_user.id}"
        cached_groups = await cache.get(cache_key)
        
        if cached_groups:
            groups = cached_groups
        else:
            # Get groups from database using the repository function
            db_groups = await get_user_groups_from_db(db, current_user.id)
            logger.info(f"Retrieved {len(db_groups)} groups from repository for user {current_user.id}")
            
            # Convert to list of dicts (for better serialization)
            groups = []
            for group in db_groups:
                # Get member count
                member_count = db.query(group_members).filter(
                    group_members.c.group_id == group.id
                ).count()
                
                # Get user's role in the group
                role_result = db.query(group_members.c.role).filter(
                    group_members.c.group_id == group.id,
                    group_members.c.user_id == current_user.id
                ).first()
                
                # FIXED: Properly determine if user is admin
                is_group_admin = group.admin_id == current_user.id
                user_role = None
                
                if role_result:
                    user_role = role_result[0].value if hasattr(role_result[0], 'value') else str(role_result[0])
                elif is_group_admin:
                    # If user is admin but not in group_members table, they should be admin
                    user_role = MemberRole.ADMIN.value
                
                # Convert to dict with all fields the frontend expects
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
                    "role": user_role,
                    "is_admin": is_group_admin
                }
                
                groups.append(group_dict)
                logger.debug(f"Processed group: {group.name} (ID: {group.id}) for user {current_user.id}")
            
            # Cache for 10 minutes
            await cache.set(cache_key, groups, 600)
            logger.info(f"Processed and cached {len(groups)} groups for user {current_user.id}")
        
        # FIXED: Return the response in the exact format the frontend expects
        response = ListResponse(
            status="success",
            message="",
            data=groups,
            total=len(groups)
        )
        
        logger.info(f"Returning {len(groups)} groups to frontend for user {current_user.id}")
        return response
        
    except Exception as e:
        # Log the error
        logger.error(f"Error getting user groups for user {current_user.id}: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        # Return empty list instead of error
        return ListResponse(
            status="error",
            message=str(e),
            data=[],
            total=0
        )

@router.get("/teams", response_model=ListResponse)
async def get_teams(
    league: str = Query(..., description="League name"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get teams available for tracking in a specific league
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Get teams from the database
        teams_data = await get_teams_by_league(db, league)
        
        # Convert to the format expected by the frontend
        teams = []
        for team in teams_data:
            teams.append({
                "id": team.id,
                "name": team.team_name,
                "logo": team.team_logo,
                "country": getattr(team, 'country', league),
                "league": league
            })
        
        logger.info(f"Returning {len(teams)} teams for league {league}")
        
        # Convert dicts to TeamInfo objects for the response
        team_info_objects = [TeamInfo(id=t["id"], name=t["name"], logo=t["logo"]) for t in teams]
        
        # Return in the expected format
        return ListResponse(
            data=team_info_objects
        )
    except Exception as e:
        logger.error(f"Error in get_teams: {str(e)}")
        return ListResponse(
            data=[]
        )  # Return empty list on error

@router.get("/debug-groups", response_model=DataResponse)
async def debug_groups(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Debug endpoint to check what get_user_groups returns
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Starting debug for user {current_user.id}")
        
        # Test individual queries first
        admin_groups = db.query(GroupModel).filter(GroupModel.admin_id == current_user.id).all()
        logger.info(f"Admin groups query returned: {len(admin_groups)} items")
        
        member_groups = db.query(GroupModel).join(
            group_members,
            GroupModel.id == group_members.c.group_id
        ).filter(
            group_members.c.user_id == current_user.id
        ).all()
        logger.info(f"Member groups query returned: {len(member_groups)} items")
        
        # Test the repository function (FIXED: Use the correct function)
        db_groups = await get_user_groups_from_db(db, current_user.id)
        
        debug_info = {
            "user_id": current_user.id,
            "admin_groups_count": len(admin_groups),
            "member_groups_count": len(member_groups),
            "final_groups_count": len(db_groups),  # FIXED: Now this works because db_groups is a list
            "admin_groups_types": [str(type(group)) for group in admin_groups],
            "member_groups_types": [str(type(group)) for group in member_groups],
            "final_groups_types": [str(type(group)) for group in db_groups],
            "groups_data": []
        }
        
        for i, group in enumerate(db_groups):
            group_info = {
                "index": i,
                "type": str(type(group)),
                "has_id": hasattr(group, 'id'),
                "repr": str(group)[:100],  # First 100 chars
                "dir": [attr for attr in dir(group) if not attr.startswith('_')][:10]  # First 10 attributes
            }
            
            if hasattr(group, 'id'):
                group_info.update({
                    "id": group.id,
                    "name": getattr(group, 'name', 'NO_NAME'),
                    "admin_id": getattr(group, 'admin_id', 'NO_ADMIN_ID')
                })
            
            debug_info["groups_data"].append(group_info)
        
        return DataResponse(data=debug_info)
        
    except Exception as e:
        logger.error(f"Debug error: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return DataResponse(
            status="error",
            message=str(e),
            data={"traceback": traceback.format_exc()}
        )

@router.post("", response_model=DataResponse)
async def create_group_endpoint(
    group_data: GroupCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Create a new group
    """
    try:
        # Create the group in the database using the aliased function
        new_group = await create_group(
            db, 
            admin_id=current_user.id, 
            **group_data.dict()
        )
        
        # Clear cache
        await cache.delete(f"user_groups:{current_user.id}")
        
        # Return success with group details
        return DataResponse(
            message="Group created successfully",
            data={
                "group_id": new_group.id,
                "invite_code": new_group.invite_code,
                "name": new_group.name
            }
        )
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

@router.post("/join", response_model=DataResponse)
async def join_group(
    join_data: LoginRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Join a group using invite code
    """
    try:
        # Get the group by invite code
        group = await get_group_by_invite_code(db, join_data.password)  # Using password field for invite code
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invite code"
            )
        
        # Check if user is already a member
        is_member = await check_group_membership(db, group.id, current_user.id)
        
        if is_member:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You are already a member of this group"
            )
        
        # Add user to group_members table
        stmt = group_members.insert().values(
            user_id=current_user.id,
            group_id=group.id,
            role=MemberRole.MEMBER,
            joined_at=datetime.now(timezone.utc),
            last_active=datetime.now(timezone.utc)
        )
        db.execute(stmt)
        db.commit()
        
        # Clear cache
        await cache.delete(f"user_groups:{current_user.id}")
        await cache.delete(f"group:{group.id}")
        
        return DataResponse(
            message="Successfully joined group",
            data={
                "group_id": group.id,
                "group_name": group.name
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        # Log the error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error joining group: {str(e)}")
        
        # Return error response
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join group: {str(e)}"
        )

@router.get("/{group_id}", response_model=DataResponse)
async def get_group_details(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
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
        # Get the actual group from the database
        group_obj = await get_group_by_id(db, group_id)
        
        if not group_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
            
        # Check if user is a member of the group
        is_member = await check_group_membership(db, group_id, current_user.id)
        
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group"
            )
        
        # Get user's role in the group
        role = await get_user_role_in_group(db, group_id, current_user.id)
        
        # Get tracked teams
        tracked_teams = await get_group_tracked_teams(db, group_id)
        
        # Convert to dict
        group = {
            "id": group_obj.id,
            "name": group_obj.name,
            "league": group_obj.league,
            "description": group_obj.description,
            "privacy_type": group_obj.privacy_type.value if group_obj.privacy_type else None,
            "admin_id": group_obj.admin_id,
            "invite_code": group_obj.invite_code,
            "created_at": group_obj.created.isoformat() if group_obj.created else None,
            "member_count": db.query(group_members).filter(group_members.c.group_id == group_id).count(),
            "role": role.value if role else None,
            "analytics": None,  # To be implemented later
            "tracked_teams": tracked_teams
        }
        
        # Cache for 10 minutes
        await cache.set(cache_key, group, 600)
    
    return DataResponse(
        data=group
    )

@router.put("/{group_id}", response_model=DataResponse)
async def update_group_endpoint(
    group_data: GroupBase,  # Using GroupBase instead of GroupUpdate
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Update group details
    """
    # Get the group from database
    group = await get_group_by_id(db, group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is admin
    if group.admin_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can update group details"
        )
    
    # Update the group using repository function
    updated_group = await update_group(db, group_id, **group_data.dict(exclude_unset=True))
    
    # Clear cache
    await cache.delete(f"group:{group_id}")
    await cache.delete(f"user_groups:{current_user.id}")
    
    return DataResponse(
        message="Group updated successfully",
        data={
            "group_id": updated_group.id,
            "name": updated_group.name
        }
    )

@router.get("/{group_id}/members", response_model=ListResponse)
async def get_group_members_endpoint(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group members including pending members for admin view
    """
    # Check if user is a member of the group OR is the admin
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is a member of the group
    is_member = await check_group_membership(db, group_id, current_user.id)
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Get members from repository
    members = await get_group_members(db, group_id)
    
    return ListResponse(
        data=members,
        total=len(members)
    )

@router.delete("/{group_id}/members/{user_id}", response_model=DataResponse)
async def remove_group_member(
    group_id: int = Path(...),
    user_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Remove a member from the group (admin only)
    """
    # Check if user is admin of the group
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.admin_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can remove members"
        )
    
    # Cannot remove the admin
    if user_id == group.admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove group admin"
        )
    
    # Remove from group_members table
    result = db.execute(
        group_members.delete().where(
            (group_members.c.group_id == group_id) & 
            (group_members.c.user_id == user_id)
        )
    )
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this group"
        )
    
    db.commit()
    
    # Clear cache
    await cache.delete(f"user_groups:{user_id}")
    await cache.delete(f"group:{group_id}")
    
    return DataResponse(
        message="Member removed successfully"
    )

@router.post("/{group_id}/regenerate-code", response_model=DataResponse)
async def regenerate_group_invite_code(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Regenerate group invite code (admin only)
    """
    # Check if user is admin of the group
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.admin_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can regenerate invite code"
        )
    
    # Regenerate the invite code
    updated_group = await regenerate_invite_code(db, group_id)
    
    # Clear cache
    await cache.delete(f"group:{group_id}")
    
    return DataResponse(
        message="Invite code regenerated successfully",
        data={
            "new_invite_code": updated_group.invite_code
        }
    )

@router.get("/{group_id}/analytics", response_model=DataResponse)
async def get_group_analytics(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group analytics
    """
    # Check if user is a member of the group
    is_member = await check_group_membership(db, group_id, current_user.id)
    
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
    
    return DataResponse(
        data=analytics
    )

@router.get("/{group_id}/audit", response_model=ListResponse)
async def get_group_audit_log(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get group audit log
    """
    # Check if user is admin
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.admin_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can view audit log"
        )
    
    # Get audit log entries
    audit_entries = db.query(GroupAuditLog).filter(
        GroupAuditLog.group_id == group_id
    ).order_by(GroupAuditLog.timestamp.desc()).limit(100).all()
    
    # Convert to dicts
    audit_data = []
    for entry in audit_entries:
        audit_data.append({
            "id": entry.id,
            "action": entry.action,
            "performed_by": entry.performed_by,
            "timestamp": entry.timestamp.isoformat(),
            "details": entry.details
        })
    
    return ListResponse(
        data=audit_data,
        total=len(audit_data)
    ) 