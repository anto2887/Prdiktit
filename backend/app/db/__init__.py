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

# Export commonly used database components
from .session import create_tables, create_tables_with_verification
from .database import engine, SessionLocal, get_db

# Export all repository functions from consolidated repository
from .repository import (
    # User functions
    get_user_by_id,
    get_user_by_username,
    get_user_by_email,
    create_user,
    update_user,
    delete_user,
    get_user_stats,

    # Match/Fixture functions
    get_fixture_by_id,
    get_fixtures,
    get_live_matches,
    create_or_update_fixture,
    get_prediction_deadlines,

    # Prediction functions
    get_prediction_by_id,
    get_user_prediction,
    get_user_predictions,
    create_prediction,
    update_prediction,
    reset_prediction,
    process_match_predictions,
    lock_predictions_for_match,
    calculate_points,

    # Team functions
    get_team_by_id,
    get_team_by_external_id,
    get_teams_by_league,
    create_team,
    update_team,
    create_or_update_team,

    # Group functions
    get_user_groups,
    get_group_by_id,
    get_group_by_invite_code,
    create_group,
    update_group,
    regenerate_invite_code,
    get_group_members,
    check_group_membership,
    get_user_role_in_group,
    get_group_tracked_teams
)

# Export all models and functions for easy importing
__all__ = [
    # Models
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
    'MembershipStatus',
    
    # Database components
    'create_tables',
    'create_tables_with_verification',
    'engine',
    'SessionLocal',
    'get_db',
    
    # Repository functions
    'get_user_by_id',
    'get_user_by_username',
    'get_user_by_email',
    'create_user',
    'update_user',
    'delete_user',
    'get_user_stats',
    'get_fixture_by_id',
    'get_fixtures',
    'get_live_matches',
    'create_or_update_fixture',
    'get_prediction_deadlines',
    'get_prediction_by_id',
    'get_user_prediction',
    'get_user_predictions',
    'create_prediction',
    'update_prediction',
    'reset_prediction',
    'process_match_predictions',
    'lock_predictions_for_match',
    'calculate_points',
    'get_team_by_id',
    'get_team_by_external_id',
    'get_teams_by_league',
    'create_team',
    'update_team',
    'create_or_update_team',
    'get_user_groups',
    'get_group_by_id',
    'get_group_by_invite_code',
    'create_group',
    'update_group',
    'regenerate_invite_code',
    'get_group_members',
    'check_group_membership',
    'get_user_role_in_group',
    'get_group_tracked_teams'
]
