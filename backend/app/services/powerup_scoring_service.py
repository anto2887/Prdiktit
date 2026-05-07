from datetime import timezone
from typing import Dict, Any

from sqlalchemy.orm import Session

from ..db.models import PowerUpDailyEffect, PowerUpType


def apply_powerup_modifiers(
    db: Session,
    *,
    user_id: int,
    group_id: int | None,
    fixture_id: int,
    fixture_date,
    base_points: int,
) -> tuple[int, Dict[str, Any]]:
    """
    Apply day-scoped power-up modifiers for a single prediction score.

    Rules:
    - Shield and freeze are day-based and group-scoped.
    - Shield nullifies freeze.
    - Freeze sets day gain to 0 for that fixture's day.
    - Multiplier doubles points for the selected fixture/day.
    """
    details = {
        "base_points": base_points,
        "shield_active": False,
        "freeze_active": False,
        "freeze_blocked_by_shield": False,
        "multiplier_active": False,
    }

    if group_id is None or fixture_date is None:
        return base_points, details

    # Normalize fixture date to UTC calendar day.
    if fixture_date.tzinfo is None:
        day = fixture_date.replace(tzinfo=timezone.utc).date()
    else:
        day = fixture_date.astimezone(timezone.utc).date()

    shield_active = db.query(PowerUpDailyEffect).filter(
        PowerUpDailyEffect.user_id == user_id,
        PowerUpDailyEffect.source_group_id == group_id,
        PowerUpDailyEffect.effective_utc_date == day,
        PowerUpDailyEffect.powerup_type == PowerUpType.SHIELD,
    ).first() is not None
    details["shield_active"] = shield_active

    freeze_active = db.query(PowerUpDailyEffect).filter(
        PowerUpDailyEffect.user_id == user_id,
        PowerUpDailyEffect.source_group_id == group_id,
        PowerUpDailyEffect.effective_utc_date == day,
        PowerUpDailyEffect.powerup_type == PowerUpType.FREEZE,
    ).first() is not None
    details["freeze_active"] = freeze_active

    adjusted = base_points
    if freeze_active and not shield_active:
        adjusted = 0
    elif freeze_active and shield_active:
        details["freeze_blocked_by_shield"] = True

    multiplier_active = db.query(PowerUpDailyEffect).filter(
        PowerUpDailyEffect.user_id == user_id,
        PowerUpDailyEffect.source_group_id == group_id,
        PowerUpDailyEffect.effective_utc_date == day,
        PowerUpDailyEffect.powerup_type == PowerUpType.MULTIPLIER,
        PowerUpDailyEffect.fixture_id == fixture_id,
    ).first() is not None
    details["multiplier_active"] = multiplier_active

    if multiplier_active:
        adjusted = adjusted * 2

    details["adjusted_points"] = adjusted
    return adjusted, details
