from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session

from ..core.security import get_current_active_user
from ..db.session import get_db
from ..services.cache_service import get_cache, RedisCache
from ..schemas.groups import (
    Group, GroupCreate, GroupDetail, GroupList, GroupUpdate,
    GroupMember, GroupMemberList, JoinGroupRequest, JoinGroupResponse,
    MemberActionRequest, MemberActionResponse, TeamInfo, TeamList,
    GroupAnalytics, AuditLogList, MemberRole, MemberAction
)
from ..schemas.user import UserInDB
from ..db.repositories.groups import (
    group_members, 
    get_group_by_id, 
    check_group_membership, 
    get_user_role_in_group, 
    get_group_tracked_teams,
    get_group_members,
    regenerate_invite_code
)
from ..db.repositories.groups import PendingMembership, MembershipStatus, GroupAuditLog

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
    # Import the repository function
    from ..db.repositories.groups import get_group_by_invite_code
    
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
        return {
            "status": "success",
            "message": "You are already a member of this group"
        }
    
    # Check if there's already a pending request
    existing_request = db.query(PendingMembership).filter(
        PendingMembership.group_id == group.id,
        PendingMembership.user_id == current_user.id,
        PendingMembership.status == MembershipStatus.PENDING
    ).first()
    
    if existing_request:
        return {
            "status": "success",
            "message": "You already have a pending request for this group"
        }
    
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
    
    # Clear relevant caches
    await cache.delete(f"user_groups:{current_user.id}")
    await cache.delete(f"group_members:{group.id}")
    
    return {
        "status": "success",
        "message": "Membership request sent. Waiting for admin approval."
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
async def get_group_members_endpoint(
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group members
    """
    # Check if user is a member of the group
    is_member = await check_group_membership(db, group_id, current_user.id)
    
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
        # Import the function from the repository to avoid name conflict
        from ..db.repositories.groups import get_group_members as get_group_members_db
        
        # Call the repository function
        members = await get_group_members_db(db, group_id)
        
        # Cache for 5 minutes
        await cache.set(cache_key, members, 300)
    
    # Process members to ensure enum values are converted to strings
    for member in members:
        if 'role' in member and hasattr(member['role'], 'value'):
            member['role'] = member['role'].value
        if 'status' in member and hasattr(member['status'], 'value'):
            member['status'] = member['status'].value
    
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
    # First check if group exists
    group = await get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user has permission to manage members
    user_role = await get_user_role_in_group(db, group_id, current_user.id)
    if not user_role or user_role not in [MemberRole.ADMIN, MemberRole.MODERATOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage members"
        )
    
    # Only admins can perform certain actions
    admin_only_actions = [MemberAction.PROMOTE, MemberAction.DEMOTE]
    if action_data.action in admin_only_actions and user_role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only admins can {action_data.action.lower()} members"
        )
    
    results = []
    for user_id in action_data.user_ids:
        try:
            # Skip if trying to perform action on self
            if user_id == current_user.id and action_data.action == MemberAction.REMOVE:
                results.append({
                    "user_id": user_id,
                    "status": "error",
                    "message": "Cannot remove yourself from the group"
                })
                continue
                
            # Skip if trying to perform action on the admin
            if group.admin_id == user_id and action_data.action in [MemberAction.REMOVE, MemberAction.DEMOTE]:
                results.append({
                    "user_id": user_id,
                    "status": "error",
                    "message": "Cannot perform this action on the group admin"
                })
                continue
                
            # Perform the actual action based on the type
            if action_data.action == MemberAction.APPROVE:
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
                
            elif action_data.action == MemberAction.REJECT:
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
                
            elif action_data.action == MemberAction.PROMOTE:
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
                
            elif action_data.action == MemberAction.DEMOTE:
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
                
            elif action_data.action == MemberAction.REMOVE:
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
                    "message": f"Unknown action: {action_data.action}"
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

@router.post("/{group_id}/regenerate-code", response_model=dict)
async def regenerate_group_code(
    group_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
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
    
    return {
        "status": "success",
        "message": "Invite code regenerated successfully",
        "data": {
            "new_code": new_code
        }
    }