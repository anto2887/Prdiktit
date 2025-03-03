from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum

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

class TeamInfo(BaseModel):
    id: Optional[int] = None
    name: str
    logo: Optional[str] = None

class MatchScore(BaseModel):
    home: Optional[int] = None
    away: Optional[int] = None

class MatchScores(BaseModel):
    halftime: Optional[MatchScore] = None
    fulltime: Optional[MatchScore] = None
    extratime: Optional[MatchScore] = None
    penalty: Optional[MatchScore] = None

class MatchBase(BaseModel):
    fixture_id: int
    home_team: str
    away_team: str
    home_team_logo: Optional[str] = None
    away_team_logo: Optional[str] = None
    date: datetime
    league: str
    season: str
    round: str
    status: MatchStatus
    home_score: int = 0
    away_score: int = 0
    venue_city: Optional[str] = None

class MatchCreate(MatchBase):
    competition_id: int
    match_timestamp: datetime

class Match(MatchBase):
    id: int
    last_updated: datetime
    last_checked: Optional[datetime] = None
    halftime_score: Optional[str] = None
    fulltime_score: Optional[str] = None
    extratime_score: Optional[str] = None
    penalty_score: Optional[str] = None
    
    class Config:
        orm_mode = True

class MatchDetail(Match):
    prediction_deadline: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class MatchList(BaseModel):
    status: str = "success"
    data: List[Match]
    
    class Config:
        orm_mode = True 