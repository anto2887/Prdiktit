# app/db/models.py
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, ForeignKey, Integer, String, 
    DateTime, Enum, Text, Table, JSON, UniqueConstraint, Index, Float, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import enum
import uuid

def utc_now():
    """Helper function to ensure all datetime fields are timezone-aware"""
    return datetime.now(timezone.utc)

from ..schemas import (
    MatchStatus, PredictionStatus, GroupPrivacyType, 
    MemberRole, MemberAction
)

Base = declarative_base()

# Local enums that aren't in schemas
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
    # FIXED: Use timezone-aware UTC instead of utcnow()
    Column("joined_at", DateTime, default=utc_now),
    Column("last_active", DateTime, default=utc_now)
)

# Models
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    # FIXED: Use timezone-aware UTC
    created_at = Column(DateTime, default=utc_now)
    
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
    
    # Analytics and week management fields
    analytics_enabled = Column(Boolean, nullable=False, default=False)
    analytics_activation_week = Column(Integer, nullable=True)
    current_week = Column(Integer, nullable=False, default=1)
    
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

    # Primary key - ✅ Frontend uses: fixture_id
    fixture_id = Column(Integer, primary_key=True)
    
    # Core fixture data - ✅ Frontend uses: date, status, round, season
    date = Column(DateTime, nullable=False)  # UTC kickoff time from API
    status = Column(Enum(MatchStatus), nullable=False, default=MatchStatus.NOT_STARTED)
    round = Column(String)
    season = Column(String, nullable=False)
    
    # Team information - ✅ Frontend uses: home_team, away_team, home_team_logo, away_team_logo
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    home_team_logo = Column(String(512), nullable=True)
    away_team_logo = Column(String(512), nullable=True)
    
    # Score information - ✅ Frontend uses: home_score, away_score
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    
    # League/Competition info - ✅ Frontend uses: league
    league = Column(String, nullable=False)
    competition_id = Column(Integer, nullable=True)
    
    # Additional fields - ✅ Frontend uses: venue, venue_city
    venue = Column(String, nullable=True)
    venue_city = Column(String, nullable=True)
    
    # Import script fields (backend only, frontend doesn't use these)
    match_timestamp = Column(DateTime, nullable=True)
    last_updated = Column(DateTime, nullable=True)
    league_id = Column(Integer, nullable=True)
    
    # REMOVE THIS LINE:
    # processed = Column(Boolean, default=False)
    
    # Relationships
    predictions = relationship("UserPrediction", back_populates="fixture")
    
    # Simple indexes
    __table_args__ = (
        Index("idx_fixture_date", "date"),
        Index("idx_fixture_status", "status"),
        Index("idx_fixture_league_season", "league", "season"),
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
    
    # Keep as timezone-naive for now to match existing data
    created = Column(DateTime, default=datetime.utcnow, nullable=False)
    # CRITICAL: All prediction timestamps in UTC
    submission_time = Column(DateTime, default=utc_now)
    last_modified = Column(DateTime, default=utc_now, onupdate=utc_now)
    processed_at = Column(DateTime, nullable=True)  # Set when prediction processed
    
    prediction_status = Column(Enum(PredictionStatus), nullable=False, default=PredictionStatus.EDITABLE)
    
    # Bonus and rivalry fields
    bonus_type = Column(String(20), nullable=True)  # 'perfect_week', 'flawless_week'
    bonus_points = Column(Integer, nullable=False, default=0)
    is_rivalry_week = Column(Boolean, nullable=False, default=False)
    
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


class UserAnalytics(Base):
    __tablename__ = "user_analytics"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    analysis_type = Column(String(50), nullable=False)  # 'comprehensive', 'weekly', 'trends'
    period = Column(String(20), nullable=False)  # season or week identifier
    data = Column(JSON, nullable=True)  # JSON data containing analytics
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        Index("idx_analytics_user_type", "user_id", "analysis_type"),
        Index("idx_analytics_period", "period"),
        UniqueConstraint("user_id", "analysis_type", "period", name="_analytics_period_uc")
    )


class RivalryPair(Base):
    __tablename__ = "rivalry_pairs"

    id = Column(Integer, primary_key=True)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    assigned_week = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_champion_challenge = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    
    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    group = relationship("Group")
    
    __table_args__ = (
        Index("idx_rivalry_group_active", "group_id", "is_active"),
        Index("idx_rivalry_week", "assigned_week"),
        CheckConstraint("user1_id != user2_id", name="check_different_users")
    )


class RivalryWeek(Base):
    __tablename__ = "rivalry_weeks"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    week = Column(Integer, nullable=False)
    season = Column(String(20), nullable=False)
    bonus_points = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    
    # Relationships
    group = relationship("Group")
    
    __table_args__ = (
        Index("idx_rivalry_weeks_group_season", "group_id", "season"),
        UniqueConstraint("group_id", "week", "season", name="_rivalry_week_uc")
    )


class UserStreak(Base):
    __tablename__ = "user_streaks"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    streak_type = Column(String(20), nullable=False)  # 'hot', 'cold', 'perfect'
    current_count = Column(Integer, nullable=False, default=0)
    max_count = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime, default=utc_now, nullable=False)
    season = Column(String(20), nullable=False)
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        Index("idx_streaks_user_season", "user_id", "season"),
        UniqueConstraint("user_id", "streak_type", "season", name="_user_streak_uc")
    )


class GroupHeatmap(Base):
    __tablename__ = "group_heatmaps"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    week = Column(Integer, nullable=False)
    season = Column(String(20), nullable=False)
    match_data = Column(JSON, nullable=True)  # Stores all match heatmaps for the week
    consensus_accuracy = Column(Float, nullable=True)  # Group accuracy percentage
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    # Relationships
    group = relationship("Group")
    
    __table_args__ = (
        Index("idx_heatmaps_group_week", "group_id", "week", "season"),
        UniqueConstraint("group_id", "week", "season", name="_heatmap_week_uc")
    )