# backend/app/utils/serializers.py
"""
Pure serialization utilities for converting SQLAlchemy objects to dictionaries.
These functions have NO dependencies on other app modules to prevent circular imports.
"""
from datetime import datetime
from typing import Dict, Any, Optional, List


def fixture_to_dict(fixture) -> Dict[str, Any]:
    """
    Convert SQLAlchemy Fixture object to dictionary for JSON serialization.
    
    Args:
        fixture: SQLAlchemy Fixture object
        
    Returns:
        Dictionary representation safe for JSON serialization
    """
    if not fixture:
        return {}
    
    return {
        "fixture_id": fixture.fixture_id,
        "date": fixture.date.isoformat() if fixture.date else None,
        "status": fixture.status.value if hasattr(fixture.status, 'value') else str(fixture.status),
        "round": fixture.round,
        "season": fixture.season,
        "home_team": fixture.home_team,
        "away_team": fixture.away_team,
        "home_team_logo": fixture.home_team_logo,
        "away_team_logo": fixture.away_team_logo,
        "home_score": fixture.home_score,
        "away_score": fixture.away_score,
        "league": fixture.league,
        "competition_id": fixture.competition_id,
        "venue": fixture.venue,
        "venue_city": fixture.venue_city,
        "match_timestamp": fixture.match_timestamp.isoformat() if fixture.match_timestamp else None,
        "last_updated": fixture.last_updated.isoformat() if fixture.last_updated else None,
        "league_id": fixture.league_id
    }


def group_to_dict(group, member_count: int = 0, user_role: str = None, is_admin: bool = False) -> Dict[str, Any]:
    """
    Convert SQLAlchemy Group object to dictionary for JSON serialization.
    
    Args:
        group: SQLAlchemy Group object
        member_count: Number of members in the group
        user_role: Current user's role in the group
        is_admin: Whether current user is admin
        
    Returns:
        Dictionary representation safe for JSON serialization
    """
    if not group:
        return {}
    
    return {
        "id": group.id,
        "name": group.name,
        "league": group.league,
        "admin_id": group.admin_id,
        "invite_code": group.invite_code,
        "created_at": group.created.isoformat() if group.created else None,
        "privacy_type": group.privacy_type.value if hasattr(group.privacy_type, 'value') else str(group.privacy_type) if group.privacy_type else None,
        "description": group.description,
        "analytics_enabled": group.analytics_enabled,
        "analytics_activation_week": group.analytics_activation_week,
        "current_week": group.current_week,
        "member_count": member_count,
        "role": user_role,
        "is_admin": is_admin
    }


def user_prediction_to_dict(prediction) -> Dict[str, Any]:
    """
    Convert SQLAlchemy UserPrediction object to dictionary for JSON serialization.
    
    Args:
        prediction: SQLAlchemy UserPrediction object
        
    Returns:
        Dictionary representation safe for JSON serialization
    """
    if not prediction:
        return {}
    
    return {
        "id": prediction.id,
        "user_id": prediction.user_id,
        "fixture_id": prediction.fixture_id,
        "week": prediction.week,
        "season": prediction.season,
        "score1": prediction.score1,
        "score2": prediction.score2,
        "points": prediction.points,
        "created": prediction.created.isoformat() if prediction.created else None,
        "submission_time": prediction.submission_time.isoformat() if prediction.submission_time else None,
        "last_modified": prediction.last_modified.isoformat() if prediction.last_modified else None,
        "processed_at": prediction.processed_at.isoformat() if prediction.processed_at else None,
        "prediction_status": prediction.prediction_status.value if hasattr(prediction.prediction_status, 'value') else str(prediction.prediction_status),
        "bonus_type": prediction.bonus_type,
        "bonus_points": prediction.bonus_points,
        "is_rivalry_week": prediction.is_rivalry_week
    }


def user_to_dict(user) -> Dict[str, Any]:
    """
    Convert SQLAlchemy User object to dictionary for JSON serialization.
    
    Args:
        user: SQLAlchemy User object
        
    Returns:
        Dictionary representation safe for JSON serialization
    """
    if not user:
        return {}
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }


def serialize_fixtures_list(fixtures: List) -> List[Dict[str, Any]]:
    """
    Safely serialize a list of fixture objects.
    
    Args:
        fixtures: List of SQLAlchemy Fixture objects
        
    Returns:
        List of dictionaries safe for JSON serialization
    """
    if not fixtures:
        return []
    
    return [fixture_to_dict(fixture) for fixture in fixtures]


def serialize_groups_list(groups: List) -> List[Dict[str, Any]]:
    """
    Safely serialize a list of group objects.
    
    Args:
        groups: List of SQLAlchemy Group objects
        
    Returns:
        List of dictionaries safe for JSON serialization
    """
    if not groups:
        return []
    
    return [group_to_dict(group) for group in groups] 