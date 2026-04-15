"""
Repair user_predictions.group_id when rows point at the wrong group:
- user is not a member of group_id
- group is missing
- fixture league does not match group league (cross-league contamination)

Idempotent: safe to run multiple times. Use dry_run=True to preview changes.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db.models import UserPrediction, Group, Fixture, group_members

logger = logging.getLogger(__name__)


def _resolve_target_group_id(
    db: Session, user_id: int, fixture_league: str
) -> Optional[int]:
    """Pick a single group for this user and fixture league (earliest join wins)."""
    row = (
        db.query(Group.id)
        .join(group_members, Group.id == group_members.c.group_id)
        .filter(
            group_members.c.user_id == user_id,
            Group.league == fixture_league,
        )
        .order_by(group_members.c.joined_at.asc())
        .first()
    )
    return row[0] if row else None


def repair_misscoped_prediction_group_ids(
    db: Session,
    *,
    dry_run: bool = True,
) -> Dict[str, Any]:
    """
    Find misscoped predictions and either repoint group_id or remove duplicate rows.

    Returns summary counts and a sample of actions (capped) for auditing.
    """
    rows: List[Any] = db.execute(
        text(
            """
            SELECT up.id, up.user_id, up.fixture_id, up.group_id
            FROM user_predictions up
            INNER JOIN fixtures f ON f.fixture_id = up.fixture_id
            LEFT JOIN groups g ON g.id = up.group_id
            WHERE up.group_id IS NOT NULL
            AND (
                NOT EXISTS (
                    SELECT 1 FROM group_members gm
                    WHERE gm.user_id = up.user_id AND gm.group_id = up.group_id
                )
                OR g.id IS NULL
                OR f.league IS DISTINCT FROM g.league
            )
            """
        )
    ).fetchall()

    actions: List[Dict[str, Any]] = []
    affected_group_ids: set = set()
    updated = 0
    deleted = 0
    skipped = 0

    for pred_id, user_id, fixture_id, bad_group_id in rows:
        fixture = db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()
        if not fixture or not fixture.league:
            skipped += 1
            actions.append(
                {
                    "prediction_id": pred_id,
                    "action": "skip_no_fixture_league",
                    "fixture_id": fixture_id,
                }
            )
            continue

        target_gid = _resolve_target_group_id(db, user_id, fixture.league)
        if target_gid is None:
            skipped += 1
            actions.append(
                {
                    "prediction_id": pred_id,
                    "action": "skip_no_target_group",
                    "user_id": user_id,
                    "fixture_league": fixture.league,
                }
            )
            continue

        if target_gid == bad_group_id:
            skipped += 1
            continue

        existing = (
            db.query(UserPrediction)
            .filter(
                UserPrediction.user_id == user_id,
                UserPrediction.fixture_id == fixture_id,
                UserPrediction.group_id == target_gid,
            )
            .first()
        )

        if existing:
            if not dry_run:
                pred_row = (
                    db.query(UserPrediction)
                    .filter(UserPrediction.id == pred_id)
                    .first()
                )
                if pred_row:
                    db.delete(pred_row)
            deleted += 1
            affected_group_ids.add(bad_group_id)
            affected_group_ids.add(target_gid)
            actions.append(
                {
                    "prediction_id": pred_id,
                    "action": "delete_duplicate",
                    "removed_group_id": bad_group_id,
                    "kept_prediction_id": existing.id,
                    "target_group_id": target_gid,
                }
            )
        else:
            if not dry_run:
                pred = db.query(UserPrediction).filter(UserPrediction.id == pred_id).first()
                if pred:
                    pred.group_id = target_gid
            updated += 1
            affected_group_ids.add(bad_group_id)
            affected_group_ids.add(target_gid)
            actions.append(
                {
                    "prediction_id": pred_id,
                    "action": "update_group_id",
                    "from_group_id": bad_group_id,
                    "to_group_id": target_gid,
                }
            )

    if not dry_run:
        db.commit()

    sample = actions[:50]
    return {
        "dry_run": dry_run,
        "examined": len(rows),
        "updated": updated,
        "deleted": deleted,
        "skipped": skipped,
        "affected_group_ids": sorted(affected_group_ids),
        "sample_actions": sample,
    }
