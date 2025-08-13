from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, EmailStr
from enum import Enum

# === ENUMS (Define here to avoid circular imports) ===
# IMPORTANT: DO NOT import from models - define all enums here

class MatchStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    FIRST_HALF = "FIRST_HALF"
    HALFTIME = "HALFTIME"
    SECOND_HALF = "SECOND_HALF"
    EXTRA_TIME = "EXTRA_TIME"
    PENALTY = "PENALTY"
    FINISHED = "FINISHED"
    FINISHED_AET = "FINISHED_AET"
    FINISHED_PEN = "FINISHED_PEN"
    BREAK_TIME = "BREAK_TIME"
    SUSPENDED = "SUSPENDED"
    INTERRUPTED = "INTERRUPTED"
    POSTPONED = "POSTPONED"
    CANCELLED = "CANCELLED"
    ABANDONED = "ABANDONED"
    TECHNICAL_LOSS = "TECHNICAL_LOSS"
    WALKOVER = "WALKOVER"
    LIVE = "LIVE"

class PredictionStatus(str, Enum):
    EDITABLE = "EDITABLE"
    SUBMITTED = "SUBMITTED"
    LOCKED = "LOCKED"
    PROCESSED = "PROCESSED"

class GroupPrivacyType(str, Enum):
    PRIVATE = "PRIVATE"
    SEMI_PRIVATE = "SEMI_PRIVATE"
    PUBLIC = "PUBLIC"

class MemberRole(str, Enum):
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"
    MEMBER = "MEMBER"

# === ENUMS ===
class MemberAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    PROMOTE = "PROMOTE"
    DEMOTE = "DEMOTE"
    REMOVE = "REMOVE"

# === BASE MODELS ===
class BaseResponse(BaseModel):
    status: str = "success"
    message: str = ""

# === USER SCHEMAS ===
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserStats(BaseModel):
    total_points: int = 0
    total_predictions: int = 0
    perfect_predictions: int = 0
    average_points: float = 0.0

# === AUTH SCHEMAS ===
class LoginRequest(BaseModel):
    username: str
    password: str
    invite_code: Optional[str] = None  # For join group endpoint

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginResponse(BaseResponse):
    data: Dict[str, Any]

# === MATCH SCHEMAS ===
class MatchBase(BaseModel):
    home_team: str
    away_team: str
    date: datetime
    league: str
    status: MatchStatus = MatchStatus.NOT_STARTED
    home_score: Optional[int] = None
    away_score: Optional[int] = None

class Match(MatchBase):
    fixture_id: int
    season: str
    round: str
    
    class Config:
        from_attributes = True

class Fixture(MatchBase):
    fixture_id: int
    season: str
    round: str
    home_team_logo: Optional[str] = None
    away_team_logo: Optional[str] = None
    venue: Optional[str] = None
    referee: Optional[str] = None
    
    class Config:
        from_attributes = True

# === PREDICTION SCHEMAS ===
class PredictionCreate(BaseModel):
    match_id: int
    home_score: int
    away_score: int

class PredictionUpdate(BaseModel):
    home_score: int
    away_score: int
    prediction_status: Optional[PredictionStatus] = None

class Prediction(BaseModel):
    id: int
    match_id: int
    user_id: int
    home_score: int
    away_score: int
    points: Optional[int] = None
    prediction_status: PredictionStatus = PredictionStatus.EDITABLE
    created: datetime
    
    class Config:
        from_attributes = True

# === USER PREDICTION WITH FIXTURE SCHEMAS ===
class FixtureSummary(BaseModel):
    fixture_id: int
    home_team: str
    away_team: str
    home_team_logo: Optional[str] = None
    away_team_logo: Optional[str] = None
    date: Optional[datetime] = None
    league: str
    status: MatchStatus
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    season: str
    round: Optional[str] = None
    venue: Optional[str] = None
    venue_city: Optional[str] = None

class UserPredictionWithFixture(BaseModel):
    id: int
    match_id: int
    user_id: int
    home_score: int
    away_score: int
    score1: int  # Legacy field for frontend compatibility
    score2: int  # Legacy field for frontend compatibility
    points: Optional[int] = None
    prediction_status: str
    created: Optional[datetime] = None
    submission_time: Optional[datetime] = None
    season: str
    week: Optional[int] = None
    fixture: FixtureSummary
    
    class Config:
        from_attributes = True

# === GROUP SCHEMAS ===
class GroupBase(BaseModel):
    name: str
    league: str
    description: Optional[str] = None

class GroupCreate(GroupBase):
    tracked_teams: Optional[List[int]] = None

class Group(GroupBase):
    id: int
    admin_id: int
    invite_code: str
    created_at: datetime
    member_count: Optional[int] = None
    privacy_type: Optional[GroupPrivacyType] = GroupPrivacyType.PRIVATE
    
    class Config:
        from_attributes = True

class GroupMember(BaseModel):
    user_id: int
    username: str
    role: MemberRole
    joined_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# === RESPONSE SCHEMAS ===
class ListResponse(BaseResponse):
    data: List[Any]
    total: int = 0

class DataResponse(BaseResponse):
    data: Any

# === TEAM SCHEMAS ===
class TeamInfo(BaseModel):
    id: int
    name: str
    logo: Optional[str] = None

    class Config:
        from_attributes = True

# === GROUP JOIN SCHEMA ===
class JoinGroupRequest(BaseModel):
    """Schema for joining a group with invite code"""
    invite_code: str = Field(..., min_length=8, max_length=8, description="8-character group invite code")
