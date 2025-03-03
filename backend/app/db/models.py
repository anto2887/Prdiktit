# app/db/models.py
from sqlalchemy import (
    Boolean, Column, ForeignKey, Integer, String, 
    DateTime, Enum, Text, Table, JSON, UniqueConstraint, Index, Float
)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum
import uuid

Base = declarative_base()

# Enums
class MatchStatus(enum.Enum):
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

class PredictionStatus(enum.Enum):
    EDITABLE = "EDITABLE"
    SUBMITTED = "SUBMITTED"
    LOCKED = "LOCKED"
    PROCESSED = "PROCESSED"

class GroupPrivacyType(enum.Enum):
    PRIVATE = "PRIVATE"
    SEMI_PRIVATE = "SEMI_PRIVATE"

class MemberRole(enum.Enum):
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"
    MEMBER = "MEMBER"

class MembershipStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

# Association tables
group_members = Table(
    "group_members",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id"), primary_key=True),
    Column("role", Enum(MemberRole), default=MemberRole.MEMBER),
    Column("joined_at", DateTime, default=datetime.utcnow),
    Column("last_active", DateTime, default=datetime.utcnow)
)

# Models
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    predictions = relationship("UserPrediction", back_populates="user")
    groups = relationship("Group", secondary=group_members, back_populates="users")
    admin_groups = relationship("Group", back_populates="admin", foreign_keys="Group.admin_id")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    league = Column(String(50), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invite_code = Column(String(8), unique=True, nullable=False, index=True)
    created = Column(DateTime, default=datetime.utcnow)
    privacy_type = Column(Enum(GroupPrivacyType), default=GroupPrivacyType.PRIVATE)
    description = Column(Text, nullable=True)
    
    # Relationships
    admin = relationship("User", back_populates="admin_groups", foreign_keys=[admin_id])
    users = relationship("User", secondary=group_members, back_populates="groups")
    tracked_teams = relationship("TeamTracker", back_populates="group")
    audit_logs = relationship("GroupAuditLog", back_populates="group")
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not kwargs.get('invite_code'):
            self.invite_code = str(uuid.uuid4())[:8].upper()

class Fixture(Base):
    __tablename__ = "fixtures"

    id = Column(Integer, primary_key=True)
    fixture_id = Column(Integer, unique=True, nullable=False, index=True)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    home_team_logo = Column(String)
    away_team_logo = Column(String)
    date = Column(DateTime, nullable=False, index=True)
    league = Column(String, nullable=False)
    season = Column(String, nullable=False)
    round = Column(String, nullable=False)
    status = Column(Enum(MatchStatus), nullable=False, default=MatchStatus.NOT_STARTED)
    home_score = Column(Integer, default=0)
    away_score = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    venue = Column(String)
    venue_city = Column(String)
    competition_id = Column(Integer, nullable=False)
    match_timestamp = Column(DateTime, nullable=False)
    last_checked = Column(DateTime, nullable=True)
    referee = Column(String)
    league_id = Column(Integer)
    
    # Additional scores
    halftime_score = Column(String)
    fulltime_score = Column(String)
    extratime_score = Column(String)
    penalty_score = Column(String)
    
    # Relationships
    predictions = relationship("UserPrediction", back_populates="fixture")
    
    __table_args__ = (
        Index("idx_fixture_date_status", "date", "status"),
        Index("idx_fixture_league_season", "league", "season"),
        Index("idx_fixture_competition", "competition_id")
    )

class UserPrediction(Base):
    __tablename__ = "user_predictions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fixture_id = Column(Integer, ForeignKey("fixtures.fixture_id"), nullable=False)
    week = Column(Integer, nullable=False)
    season = Column(String, nullable=False)
    score1 = Column(Integer, nullable=False, default=0)
    score2 = Column(Integer, nullable=False, default=0)
    points = Column(Integer, nullable=False, default=0)
    created = Column(DateTime, default=datetime.utcnow, nullable=False)
    prediction_status = Column(Enum(PredictionStatus), nullable=False, default=PredictionStatus.EDITABLE)
    submission_time = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    last_modified = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="predictions")
    fixture = relationship("Fixture", back_populates="predictions")
    
    __table_args__ = (
        UniqueConstraint("user_id", "fixture_id", name="_user_fixture_uc"),
        Index("idx_predictions_status", "prediction_status"),
        Index("idx_predictions_fixture", "fixture_id")
    )

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, nullable=False, unique=True)
    team_name = Column(String(255), unique=True, nullable=False)
    team_logo = Column(String(512))
    country = Column(String(50))
    league_id = Column(Integer)

class TeamTracker(Base):
    __tablename__ = "team_tracker"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("Group", back_populates="tracked_teams")
    
    __table_args__ = (
        UniqueConstraint("group_id", "team_id", name="_group_team_uc"),
    )

class PendingMembership(Base):
    __tablename__ = "pending_memberships"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(MembershipStatus), default=MembershipStatus.PENDING)
    requested_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class UserResults(Base):
    __tablename__ = "user_results"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points = Column(Integer, nullable=False, default=0)
    season = Column(String, nullable=False)
    week = Column(Integer, nullable=True)
    
    # Relationships
    user = relationship("User")

class GroupAuditLog(Base):
    __tablename__ = "group_audit_logs"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("Group", back_populates="audit_logs")
    
    __table_args__ = (
        Index("idx_audit_group_date", "group_id", "created_at"),
    )

class GroupAnalytics(Base):
    __tablename__ = "group_analytics"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    analysis_type = Column(String, nullable=False)
    period = Column(String, nullable=False)
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_analytics_group_type", "group_id", "analysis_type"),
        UniqueConstraint("group_id", "analysis_type", "period", name="_analytics_period_uc")
    )