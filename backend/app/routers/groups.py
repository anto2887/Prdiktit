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
    get_user_groups,
    create_group,
    get_group_by_invite_code,
    get_teams_by_league,
    update_group
)
from ..db.models import (
    PendingMembership,
    MembershipStatus,
    GroupAuditLog
)
from ..schemas import (
    Group, GroupCreate, GroupBase, GroupMember, 
    GroupPrivacyType, MemberRole, LoginRequest,
    ListResponse, DataResponse, User, TeamInfo,
    MemberAction
)

router = APIRouter()

@router.get("", response_model=ListResponse)
async def get_user_groups(
    current_user: User = Depends(get_current_active_user),
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
            # Get groups from database
            db_groups = await get_user_groups(db, current_user.id)
            
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
                    "role": user_role,
                    "is_admin": is_group_admin
                }
                
                groups.append(group_dict)
            
            # Cache for 10 minutes
            await cache.set(cache_key, groups, 600)
        
        return ListResponse(
            status="success",
            message="",
            data=groups,
            total=len(groups)
        )
    except Exception as e:
        # Log the error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting user groups: {str(e)}")
        
        # Return empty list instead of error
        return ListResponse(
            status="error",
            message=str(e),
            data=[],
            total=0
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
    # Get group by invite code
    group = await get_group_by_invite_code(db, join_data.invite_code)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code"
        )
    
    # Check if user is already a member
    is_member = await check_group_membership(db, group.id, current_user.id)
    
    if is_member:
        return DataResponse(
            message="You are already a member of this group"
        )
    
    # Check if there's already a pending request
    existing_request = db.query(PendingMembership).filter(
        PendingMembership.group_id == group.id,
        PendingMembership.user_id == current_user.id,
        PendingMembership.status == MembershipStatus.PENDING
    ).first()
    
    if existing_request:
        return DataResponse(
            message="You already have a pending request for this group"
        )
    
    # Create pending membership request
    pending_membership = PendingMembership(
        group_id=group.id,
        user_id=current_user.id,
        status=MembershipStatus.PENDING,
        requested_at=datetime.now(timezone.utc)
    )
    
    db.add(pending_membership)
    
    # Add audit log entry
    log_entry = GroupAuditLog(
        group_id=group.id,
        user_id=current_user.id,
        action=f"User {current_user.username} requested to join group",
        details={"user_id": current_user.id, "username": current_user.username},
        created_at=datetime.now(timezone.utc)
    )
    db.add(log_entry)
    
    # Commit the changes
    db.commit()
    
    # FIXED: Clear relevant caches with specific keys
    await cache.delete(f"user_groups:{current_user.id}")
    await cache.delete(f"group_members:{group.id}")
    await cache.delete(f"group:{group.id}")
    
    return DataResponse(
        message="Membership request sent. Waiting for admin approval."
    )

@router.get("/teams", response_model=ListResponse)
async def get_teams(
    league: str = Query(..., description="League name or ID"),
    current_user: User = Depends(get_current_active_user),
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
        return ListResponse(
            data=team_info_objects
        )
    except Exception as e:
        logger.error(f"Error in get_teams: {str(e)}")
        return ListResponse(
            data=[]
        )  # Return empty list on error

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
async def update_group(
    group_data: GroupBase,  # Using GroupBase instead of GroupUpdate
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
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
    
    return DataResponse(
        message="Group updated successfully"
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
    
    is_member = await check_group_membership(db, group_id, current_user.id)
    is_admin = group.admin_id == current_user.id
    
    if not is_member and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # FIXED: Use group_id specific cache key
    cache_key = f"group_members:{group_id}"
    cached_members = await cache.get(cache_key)
    
    if cached_members:
        members = cached_members
        print(f"DEBUG: Using cached members for group {group_id}: {len(members)} members")
    else:
        print(f"DEBUG: Fetching fresh members for group {group_id}")
        members = await get_group_members(db, group_id)
        print(f"DEBUG: Fresh fetch returned {len(members)} members for group {group_id}")
        
        # FIXED: Only cache if we have valid data
        if members:
            await cache.set(cache_key, members, 300)  # Cache for 5 minutes
            print(f"DEBUG: Cached {len(members)} members for group {group_id}")
    
    # Process members with safe datetime handling
    processed_members = []
    for member in members:
        def safe_isoformat(value):
            """Safely convert datetime to ISO format string"""
            if not value:
                return None
            if hasattr(value, 'isoformat'):
                return value.isoformat()
            return str(value)
        
        processed_member = {
            'user_id': member.get('user_id'),
            'username': member.get('username'),
            'role': member.get('role'),
            'joined_at': safe_isoformat(member.get('joined_at')),
            'last_active': safe_isoformat(member.get('last_active')),
        }
        
        # Add status and requested_at for pending members
        if 'status' in member:
            processed_member['status'] = member['status']
        if 'requested_at' in member:
            processed_member['requested_at'] = safe_isoformat(member['requested_at'])
            
        processed_members.append(processed_member)
    
    print(f"DEBUG: Returning {len(processed_members)} processed members for group {group_id}")
    return ListResponse(
        data=processed_members
    )

@router.post("/{group_id}/members", response_model=DataResponse)
async def manage_group_members(
    action: str = Query(..., description="Action to perform: approve, reject, promote, demote, remove"),
    user_ids: List[int] = Query(..., description="List of user IDs to perform action on"),
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Manage group members (approve, reject, promote, demote, remove)
    """
    # First check if group exists
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # FIXED: Check if user is admin of the group FIRST
    if group.admin_id == current_user.id:
        # User is the group admin, they have permission
        user_role = MemberRole.ADMIN
    else:
        # Check if user has permission to manage members through group membership
        user_role = await get_user_role_in_group(db, group_id, current_user.id)
        if not user_role or user_role not in [MemberRole.ADMIN, MemberRole.MODERATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to manage members"
            )

    # Only admins can perform certain actions
    admin_only_actions = [MemberAction.PROMOTE, MemberAction.DEMOTE]
    if action in admin_only_actions and user_role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only admins can {action.lower()} members"
        )
    
    results = []
    for user_id in user_ids:
        try:
            # Skip if trying to perform action on self
            if user_id == current_user.id and action == MemberAction.REMOVE:
                results.append({
                    "user_id": user_id,
                    "status": "error",
                    "message": "Cannot remove yourself from the group"
                })
                continue
                
            # Skip if trying to perform action on the admin
            if group.admin_id == user_id and action in [MemberAction.REMOVE, MemberAction.DEMOTE]:
                results.append({
                    "user_id": user_id,
                    "status": "error",
                    "message": "Cannot perform this action on the group admin"
                })
                continue
                
            # Perform the actual action based on the type
            if action == MemberAction.APPROVE:
                # Check if there's a pending membership request
                pending_request = db.query(PendingMembership).filter(
                    PendingMembership.group_id == group_id,
                    PendingMembership.user_id == user_id,
                    PendingMembership.status == MembershipStatus.PENDING
                ).first()
                
                if not pending_request:
                    results.append({
                        "user_id": user_id,
                        "status": "error",
                        "message": "No pending request found"
                    })
                    continue
                    
                # Add user to group members
                db.execute(
                    group_members.insert().values(
                        user_id=user_id,
                        group_id=group_id,
                        role=MemberRole.MEMBER,
                        joined_at=datetime.now(timezone.utc),
                        last_active=datetime.now(timezone.utc)
                    )
                )
                
                # Update pending request
                pending_request.status = MembershipStatus.APPROVED
                pending_request.processed_at = datetime.now(timezone.utc)
                pending_request.processed_by = current_user.id
                
                # Add audit log
                log_entry = GroupAuditLog(
                    group_id=group_id,
                    user_id=current_user.id,
                    action=f"Approved membership for user {user_id}",
                    details={"target_user_id": user_id},
                    created_at=datetime.now(timezone.utc)
                )
                db.add(log_entry)
                
                results.append({
                    "user_id": user_id,
                    "status": "success",
                    "message": "Member approved successfully"
                })
                
            elif action == MemberAction.REJECT:
                # Check if there's a pending membership request
                pending_request = db.query(PendingMembership).filter(
                    PendingMembership.group_id == group_id,
                    PendingMembership.user_id == user_id,
                    PendingMembership.status == MembershipStatus.PENDING
                ).first()
                
                if not pending_request:
                    results.append({
                        "user_id": user_id,
                        "status": "error",
                        "message": "No pending request found"
                    })
                    continue
                    
                # Update pending request
                pending_request.status = MembershipStatus.REJECTED
                pending_request.processed_at = datetime.now(timezone.utc)
                pending_request.processed_by = current_user.id
                
                # Add audit log
                log_entry = GroupAuditLog(
                    group_id=group_id,
                    user_id=current_user.id,
                    action=f"Rejected membership for user {user_id}",
                    details={"target_user_id": user_id},
                    created_at=datetime.now(timezone.utc)
                )
                db.add(log_entry)
                
                results.append({
                    "user_id": user_id,
                    "status": "success",
                    "message": "Membership request rejected"
                })
                
            elif action == MemberAction.PROMOTE:
                # Check if user is a member
                member = db.query(group_members).filter(
                    group_members.c.group_id == group_id,
                    group_members.c.user_id == user_id
                ).first()
                
                if not member:
                    results.append({
                        "user_id": user_id,
                        "status": "error",
                        "message": "User is not a member of this group"
                    })
                    continue
                    
                # Update member role to moderator
                db.execute(
                    group_members.update().
                    where(
                        group_members.c.group_id == group_id,
                        group_members.c.user_id == user_id
                    ).
                    values(role=MemberRole.MODERATOR)
                )
                
                # Add audit log
                log_entry = GroupAuditLog(
                    group_id=group_id,
                    user_id=current_user.id,
                    action=f"Promoted user {user_id} to moderator",
                    details={"target_user_id": user_id},
                    created_at=datetime.now(timezone.utc)
                )
                db.add(log_entry)
                
                results.append({
                    "user_id": user_id,
                    "status": "success",
                    "message": "Member promoted to moderator"
                })
                
            elif action == MemberAction.DEMOTE:
                # Check if user is a moderator
                member = db.query(group_members).filter(
                    group_members.c.group_id == group_id,
                    group_members.c.user_id == user_id,
                    group_members.c.role == MemberRole.MODERATOR
                ).first()
                
                if not member:
                    results.append({
                        "user_id": user_id,
                        "status": "error",
                        "message": "User is not a moderator of this group"
                    })
                    continue
                    
                # Update member role to regular member
                db.execute(
                    group_members.update().
                    where(
                        group_members.c.group_id == group_id,
                        group_members.c.user_id == user_id
                    ).
                    values(role=MemberRole.MEMBER)
                )
                
                # Add audit log
                log_entry = GroupAuditLog(
                    group_id=group_id,
                    user_id=current_user.id,
                    action=f"Demoted user {user_id} from moderator",
                    details={"target_user_id": user_id},
                    created_at=datetime.now(timezone.utc)
                )
                db.add(log_entry)
                
                results.append({
                    "user_id": user_id,
                    "status": "success",
                    "message": "Moderator demoted to member"
                })
                
            elif action == MemberAction.REMOVE:
                # Check if user is a member
                member = db.query(group_members).filter(
                    group_members.c.group_id == group_id,
                    group_members.c.user_id == user_id
                ).first()
                
                if not member:
                    results.append({
                        "user_id": user_id,
                        "status": "error",
                        "message": "User is not a member of this group"
                    })
                    continue
                    
                # Remove user from group
                db.execute(
                    group_members.delete().
                    where(
                        group_members.c.group_id == group_id,
                        group_members.c.user_id == user_id
                    )
                )
                
                # Add audit log
                log_entry = GroupAuditLog(
                    group_id=group_id,
                    user_id=current_user.id,
                    action=f"Removed user {user_id} from group",
                    details={"target_user_id": user_id},
                    created_at=datetime.now(timezone.utc)
                )
                db.add(log_entry)
                
                results.append({
                    "user_id": user_id,
                    "status": "success",
                    "message": "Member removed from group"
                })
                
            else:
                # Unknown action
                results.append({
                    "user_id": user_id,
                    "status": "error",
                    "message": f"Unknown action: {action}"
                })
        
        except Exception as e:
            # Log the error
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error processing member action: {str(e)}")
            
            # Add to results
            results.append({
                "user_id": user_id,
                "status": "error",
                "message": str(e)
            })
    
    # Commit all changes
    db.commit()
    
    # FIXED: Clear cache for this specific group
    await cache.delete(f"group_members:{group_id}")
    await cache.delete(f"group:{group_id}")
    
    # FIXED: Also clear user groups cache for affected users
    affected_user_ids = user_ids + [current_user.id]  # Include current user
    for user_id in affected_user_ids:
        await cache.delete(f"user_groups:{user_id}")
    
    return DataResponse(
        message=f"{action} action completed",
        data=results
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
    
    return ListResponse(
        data=logs
    )

@router.post("/{group_id}/regenerate-code", response_model=DataResponse)
async def regenerate_group_code(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Regenerate group invite code
    """
    # Check if group exists
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is the admin
    if group.admin_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group admin can regenerate the invite code"
        )
    
    # Generate a new invite code
    new_code = await regenerate_invite_code(db, group_id)
    if not new_code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate invite code"
        )
    
    # Clear cache
    await cache.delete(f"group:{group_id}")
    
    # Add audit log
    log_entry = GroupAuditLog(
        group_id=group_id,
        user_id=current_user.id,
        action="Regenerated invite code",
        created_at=datetime.now(timezone.utc)
    )
    db.add(log_entry)
    db.commit()
    
    return DataResponse(
        message="Invite code regenerated successfully",
        data={
            "new_code": new_code
        }
    )