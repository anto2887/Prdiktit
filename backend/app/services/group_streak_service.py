"""
Per-group prediction streak milestones (qualifying fixtures only).
Milestones at 5, 10, 15, ... consecutive finished qualifying fixtures with a prediction.
Void/postponed/cancelled fixtures are skipped in the sequence (do not break, do not advance).
"""
import logging
from typing import List, Optional, Set

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db.models import (
    Fixture,
    Group,
    MatchStatus,
    Team,
    TeamTracker,
    UserGroupPredictionStreak,
    UserPrediction,
    CoinTransactionType,
)
from .coin_service import CoinService

logger = logging.getLogger(__name__)

FINISHED_STATUSES: Set[MatchStatus] = {
    MatchStatus.FINISHED,
    MatchStatus.FINISHED_AET,
    MatchStatus.FINISHED_PEN,
}

VOID_STATUSES: Set[MatchStatus] = {
    MatchStatus.POSTPONED,
    MatchStatus.CANCELLED,
    MatchStatus.ABANDONED,
    MatchStatus.WALKOVER,
    MatchStatus.TECHNICAL_LOSS,
}

STREAK_MILESTONE_COINS = 100
MILESTONE_INTERVAL = 5


def _team_ids_for_fixture(session: Session, fixture: Fixture) -> Set[int]:
    ids: Set[int] = set()
    if fixture.home_team:
        ht = (
            session.query(Team)
            .filter(func.lower(Team.team_name) == func.lower(fixture.home_team.strip()))
            .first()
        )
        if ht:
            ids.add(ht.id)
    if fixture.away_team:
        at = (
            session.query(Team)
            .filter(func.lower(Team.team_name) == func.lower(fixture.away_team.strip()))
            .first()
        )
        if at:
            ids.add(at.id)
    return ids


def fixture_qualifies_for_group(session: Session, fixture: Fixture, group: Group) -> bool:
    if not fixture.league or not group.league or fixture.league != group.league:
        return False
    tracked_ids = {
        r.team_id for r in session.query(TeamTracker).filter(TeamTracker.group_id == group.id).all()
    }
    if not tracked_ids:
        return False
    return bool(_team_ids_for_fixture(session, fixture) & tracked_ids)


def _ordered_qualifying_fixtures(session: Session, group: Group, season: str) -> List[Fixture]:
    rows = (
        session.query(Fixture)
        .filter(Fixture.league == group.league, Fixture.season == season)
        .order_by(Fixture.date.asc(), Fixture.fixture_id.asc())
        .all()
    )
    return [fx for fx in rows if fixture_qualifies_for_group(session, fx, group)]


def _is_void_status(status: MatchStatus) -> bool:
    return status in VOID_STATUSES


def _is_finished_status(status: MatchStatus) -> bool:
    return status in FINISHED_STATUSES


def _previous_finished_qualifying_id(
    ordered: List[Fixture], before_index: int
) -> Optional[int]:
    for i in range(before_index - 1, -1, -1):
        fx = ordered[i]
        if _is_void_status(fx.status):
            continue
        if _is_finished_status(fx.status):
            return fx.fixture_id
    return None


def _has_gap_before(
    session: Session,
    user_id: int,
    group_id: int,
    ordered: List[Fixture],
    before_index: int,
) -> bool:
    """Any finished qualifying fixture before `before_index` with no user prediction breaks the chain."""
    for i in range(before_index):
        fx = ordered[i]
        if _is_void_status(fx.status):
            continue
        if not _is_finished_status(fx.status):
            continue
        pred = (
            session.query(UserPrediction)
            .filter(
                UserPrediction.user_id == user_id,
                UserPrediction.group_id == group_id,
                UserPrediction.fixture_id == fx.fixture_id,
            )
            .first()
        )
        if not pred:
            return True
    return False


def process_streak_on_first_time_processed(
    session: Session,
    *,
    user_id: int,
    group_id: int,
    season: str,
    fixture_id: int,
    old_prediction_status: str,
    match: Fixture,
) -> None:
    if old_prediction_status == "PROCESSED":
        return
    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        return
    if not fixture_qualifies_for_group(session, match, group):
        return
    if not _is_finished_status(match.status):
        return

    ordered = _ordered_qualifying_fixtures(session, group, season)
    try:
        idx = next(i for i, f in enumerate(ordered) if f.fixture_id == fixture_id)
    except StopIteration:
        return

    if _has_gap_before(session, user_id, group_id, ordered, idx):
        consecutive = 1
    else:
        prev_finish_id = _previous_finished_qualifying_id(ordered, idx)
        row = (
            session.query(UserGroupPredictionStreak)
            .filter(
                UserGroupPredictionStreak.user_id == user_id,
                UserGroupPredictionStreak.group_id == group_id,
                UserGroupPredictionStreak.season == season,
            )
            .first()
        )
        if prev_finish_id is None:
            consecutive = 1
        elif row and row.last_qualifying_fixture_id == prev_finish_id:
            consecutive = row.consecutive_count + 1
        else:
            consecutive = 1

    row = (
        session.query(UserGroupPredictionStreak)
        .filter(
            UserGroupPredictionStreak.user_id == user_id,
            UserGroupPredictionStreak.group_id == group_id,
            UserGroupPredictionStreak.season == season,
        )
        .first()
    )
    if not row:
        row = UserGroupPredictionStreak(
            user_id=user_id,
            group_id=group_id,
            season=season,
            consecutive_count=consecutive,
            last_qualifying_fixture_id=fixture_id,
        )
        session.add(row)
    else:
        row.consecutive_count = consecutive
        row.last_qualifying_fixture_id = fixture_id

    session.flush()

    if consecutive >= MILESTONE_INTERVAL and consecutive % MILESTONE_INTERVAL == 0:
        key = (
            f"streak_milestone:user:{user_id}:group:{group_id}:season:{season}:m:{consecutive}"
        )
        CoinService.credit_coins_idempotent(
            db=session,
            user_id=user_id,
            amount_coins=STREAK_MILESTONE_COINS,
            idempotency_key=key,
            transaction_type=CoinTransactionType.CREDIT_PROMO,
            details={
                "reason": "group_prediction_streak",
                "group_id": group_id,
                "season": season,
                "milestone": consecutive,
                "fixture_id": fixture_id,
            },
        )
