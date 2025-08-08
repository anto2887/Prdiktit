# app/db/__init__.py
"""
Database package initialization
Ensures all models are properly imported and registered with SQLAlchemy Base
"""

# Import all models to ensure they're registered with Base.metadata
from .models import (
    Base,
    User,
    Group,
    Fixture,
    Team,
    UserPrediction,
    TeamTracker,
    PendingMembership,
    UserResults,
    GroupAuditLog,
    GroupAnalytics,
    UserAnalytics,
    RivalryPair,
    RivalryWeek,
    UserStreak,
    GroupHeatmap,
    group_members,
    MembershipStatus
)

# Export all models for easy importing
__all__ = [
    'Base',
    'User',
    'Group', 
    'Fixture',
    'Team',
    'UserPrediction',
    'TeamTracker',
    'PendingMembership',
    'UserResults',
    'GroupAuditLog',
    'GroupAnalytics',
    'UserAnalytics',
    'RivalryPair',
    'RivalryWeek',
    'UserStreak',
    'GroupHeatmap',
    'group_members',
    'MembershipStatus'
]
