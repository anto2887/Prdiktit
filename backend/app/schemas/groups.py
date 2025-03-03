# app/schemas/group.py
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum

# Enums
class GroupPrivacyType(str, Enum):
    PRIVATE = "PRIVATE"
    SEMI_PRIVATE = "SEMI_PRIVATE"

class MemberRole(str, Enum):
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"
    MEMBER = "MEMBER"

class MembershipStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

# Group schemas
class GroupBase(BaseModel):
    name: str
    league: str
    description: Optional[str] = None
    privacy_type: GroupPrivacyType = GroupPrivacyType.PRIVATE

class GroupCreate(GroupBase):
    tracked_teams: Optional[List[int]] = None

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    privacy_type: Optional[GroupPrivacyType] = None
    tracked_teams: Optional[List[int]] = None

class GroupMember(BaseModel):
    user_id: int
    username: str
    role: MemberRole
    joined_at: datetime
    last_active: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class Group(GroupBase):
    id: int
    admin_id: int
    invite_code: str
    created_at: datetime
    member_count: Optional[int] = None
    role: Optional[MemberRole] = None
    
    class Config:
        orm_mode = True

class GroupDetail(Group):
    analytics: Optional[Dict[str, Any]] = None
    tracked_teams: List[int] = []
    
    class Config:
        orm_mode = True

class GroupList(BaseModel):
    status: str = "success"
    data: List[Group]
    
    class Config:
        orm_mode = True

class GroupMemberList(BaseModel):
    status: str = "success"
    data: List[GroupMember]
    
    class Config:
        orm_mode = True

class JoinGroupRequest(BaseModel):
    invite_code: str

class JoinGroupResponse(BaseModel):
    status: str = "success"
    message: str
    
    class Config:
        orm_mode = True

class MemberAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    PROMOTE = "PROMOTE"
    DEMOTE = "DEMOTE"
    REMOVE = "REMOVE"

class MemberActionRequest(BaseModel):
    user_ids: List[int]
    action: MemberAction

class MemberActionResponse(BaseModel):
    status: str = "success"
    message: str
    data: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        orm_mode = True

class TeamInfo(BaseModel):
    id: int
    name: str
    logo: Optional[str] = None
    
    class Config:
        orm_mode = True

class TeamList(BaseModel):
    status: str = "success"
    data: List[TeamInfo]
    
    class Config:
        orm_mode = True

class GroupAnalytics(BaseModel):
    overall_stats: Dict[str, Any]
    member_performance: List[Dict[str, Any]]
    prediction_patterns: Dict[str, Any]
    weekly_trends: List[Dict[str, Any]]
    generated_at: str
    
    class Config:
        orm_mode = True

class AuditLogEntry(BaseModel):
    id: int
    action: str
    user: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        orm_mode = True

class AuditLogList(BaseModel):
    status: str = "success"
    data: List[AuditLogEntry]
    
    class Config:
        orm_mode = True