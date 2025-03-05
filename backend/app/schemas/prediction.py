# app/schemas/prediction.py
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
from .match import MatchScore, MatchStatus

# Enums
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
    PENDING = "PENDING"
    CORRECT = "CORRECT"
    INCORRECT = "INCORRECT"
    PARTIAL = "PARTIAL"
    CANCELLED = "CANCELLED"

# User reference for predictions
class UserBase(BaseModel):
    username: str
    email: str

class UserRef(UserBase):
    id: int
    
    class Config:
        from_attributes = True

# Match schemas
class MatchBase(BaseModel):
    home_team: str
    away_team: str
    match_date: datetime
    competition: str
    status: MatchStatus = MatchStatus.NOT_STARTED
    home_score: Optional[int] = None
    away_score: Optional[int] = None

class MatchCreate(MatchBase):
    pass

class Match(MatchBase):
    id: int
    
    class Config:
        from_attributes = True

class MatchDetail(Match):
    predictions_count: Optional[int] = None
    user_prediction: Optional[Dict[str, Any]] = None
    prediction_deadline: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class MatchList(BaseModel):
    matches: List[Match]
    total: int = Field(..., description="Total number of matches")
    
    class Config:
        from_attributes = True

# Batch prediction schemas
class ScorePrediction(BaseModel):
    home: int
    away: int

class BatchPredictionCreate(BaseModel):
    predictions: Dict[str, ScorePrediction]

class BatchPredictionResponse(BaseModel):
    status: str
    message: str
    data: List[Dict[str, Any]]

# Prediction schemas
class PredictionBase(BaseModel):
    home_score: int
    away_score: int

class PredictionCreate(PredictionBase):
    match_id: int

class Prediction(PredictionBase):
    id: int
    match_id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    points: Optional[int] = None
    prediction_status: PredictionStatus = PredictionStatus.PENDING
    
    class Config:
        from_attributes = True

class PredictionWithMatch(Prediction):
    match: Match
    
    class Config:
        from_attributes = True

class PredictionWithUser(Prediction):
    user: UserRef
    
    class Config:
        from_attributes = True

class PredictionComplete(Prediction):
    match: Match
    user: UserRef
    
    class Config:
        from_attributes = True

class PredictionList(BaseModel):
    status: str
    data: List[PredictionWithMatch]

# Response schemas
class MatchResponse(BaseModel):
    status: str = "success"
    data: Match
    message: str = "Match retrieved successfully"

class MatchListResponse(BaseModel):
    status: str = "success"
    data: MatchList
    message: str = "Matches retrieved successfully"

class PredictionResponse(BaseModel):
    status: str = "success"
    data: Prediction
    message: str = "Prediction created successfully"

class PredictionListResponse(BaseModel):
    status: str = "success"
    data: List[PredictionWithMatch]
    message: str = "Predictions retrieved successfully"

class FixtureInfo(BaseModel):
    home_team: str
    away_team: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: MatchStatus
    date: datetime
    
    class Config:
        orm_mode = True

class PredictionUpdate(BaseModel):
    score1: Optional[int] = None
    score2: Optional[int] = None