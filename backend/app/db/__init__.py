# Export commonly used database components
from .session import create_tables
from .database import engine, SessionLocal, get_db
from .models import *

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

__all__ = ['create_tables', 'engine', 'SessionLocal', 'get_db']
