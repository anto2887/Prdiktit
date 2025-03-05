# app/schemas/prediction.py
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from enum import Enum
from .match import MatchScore, MatchStatus

# Enums
class PredictionStatus(str, Enum):
    EDITABLE = "EDITABLE"
    SUBMITTED = "SUBMITTED"
    LOCKED = "LOCKED"
    PROCESSED = "PROCESSED"

# Prediction schemas
class PredictionBase(BaseModel):
    fixture_id: int
    score1: int
    score2: int

class PredictionCreate(PredictionBase):
    pass

class PredictionUpdate(BaseModel):
    score1: Optional[int] = None
    score2: Optional[int] = None

class FixtureInfo(BaseModel):
    home_team: str
    away_team: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: MatchStatus
    date: datetime
    
    class Config:
        orm_mode = True

class Prediction(PredictionBase):
    id: int
    user_id: int
    prediction_status: PredictionStatus
    points: int = 0
    submission_time: Optional[datetime] = None
    fixture: FixtureInfo
    
    class Config:
        orm_mode = True

class PredictionResponse(BaseModel):
    status: str = "success"
    data: Prediction
    
    class Config:
        orm_mode = True

class PredictionList(BaseModel):
    status: str = "success"
    data: List[Prediction]
    
    class Config:
        orm_mode = True

class BatchPredictionCreate(BaseModel):
    predictions: Dict[int, MatchScore]  # fixture_id -> scores

class BatchPredictionResponse(BaseModel):
    status: str = "success"
    message: str
    data: List[Dict[str, Any]]

class Match(BaseModel):
    id: int
    home_team: str
    away_team: str
    match_date: datetime
    competition: str
    status: str = "SCHEDULED"
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    
    class Config:
        from_attributes = True  # This replaces orm_mode=True in Pydantic v2