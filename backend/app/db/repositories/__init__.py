# Export repository functions for easier imports
from .users import (
    get_user_by_id,
    get_user_by_username,
    get_user_by_email,
    create_user,
    update_user,
    delete_user,
    get_user_stats
)

from .matches import (
    get_fixture_by_id,
    get_fixtures,
    get_live_matches,
    create_or_update_fixture,
    get_prediction_deadlines
)

from .predictions import (
    get_prediction_by_id,
    get_user_prediction,
    get_user_predictions,
    create_prediction,
    update_prediction,
    reset_prediction,
    process_match_predictions,
    lock_predictions_for_match,
    calculate_points
) 

from .teams import (
    get_team_by_id,
    get_team_by_external_id,
    get_teams_by_league,
    get_teams_by_league_id
)

from .groups import (
    check_group_membership,
    get_user_role_in_group,
    get_group_tracked_teams
)