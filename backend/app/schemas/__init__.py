from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, EmailStr
from enum import Enum

# Import enums from models to avoid circular imports
try:
    from ..db.models import MatchStatus, PredictionStatus, GroupPrivacyType, MemberRole
except ImportError:
    # Fallback definitions in case of import issues
    from enum import Enum
    
    class MatchStatus(str, Enum):
        NOT_STARTED = "NOT_STARTED"
        LIVE = "LIVE" 
        FINISHED = "FINISHED"
        CANCELLED = "CANCELLED"

    class PredictionStatus(str, Enum):
        PENDING = "PENDING"
        CORRECT = "CORRECT"
        INCORRECT = "INCORRECT"

    class GroupPrivacyType(str, Enum):
        PRIVATE = "PRIVATE"
        SEMI_PRIVATE = "SEMI_PRIVATE"

    class MemberRole(str, Enum):
        ADMIN = "ADMIN"
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
        orm_mode = True

class UserStats(BaseModel):
    total_points: int = 0
    total_predictions: int = 0
    perfect_predictions: int = 0
    average_points: float = 0.0

# === AUTH SCHEMAS ===
class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginResponse(BaseResponse):
    data: Dict[str, Any]

# === MATCH SCHEMAS ===
class MatchBase(BaseModel):
    home_team: str
    away_team: str
    match_date: datetime
    competition: str
    status: MatchStatus = MatchStatus.NOT_STARTED
    home_score: Optional[int] = None
    away_score: Optional[int] = None

class Match(MatchBase):
    id: int
    
    class Config:
        orm_mode = True

# === PREDICTION SCHEMAS ===
class PredictionCreate(BaseModel):
    match_id: int
    home_score: int
    away_score: int

class Prediction(BaseModel):
    id: int
    match_id: int
    user_id: int
    home_score: int
    away_score: int
    points: Optional[int] = None
    status: PredictionStatus = PredictionStatus.PENDING
    created_at: datetime
    
    class Config:
        orm_mode = True

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
    
    class Config:
        orm_mode = True

class GroupMember(BaseModel):
    user_id: int
    username: str
    role: MemberRole
    joined_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

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
        orm_mode = True
