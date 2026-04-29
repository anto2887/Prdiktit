import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..db.models import (
    Fixture,
    GlobalCanonicalEntry,
    GlobalCompetitionWindow,
    Group,
    MatchStatus,
    PredictionStatus,
    RivalryPair,
    User,
    UserPrediction,
)

logger = logging.getLogger(__name__)

WORLD_CUP_COMPETITION_CODE = "world_cup_2026"
WORLD_CUP_LEAGUE = "World Cup"
DEFAULT_WORLD_CUP_SEASON = "2026"
DEFAULT_CANONICAL_LOCK_AT_UTC = datetime(2026, 6, 23, 23, 59, 59, tzinfo=timezone.utc)


class WorldCupGlobalService:
    """World Cup-specific canonical-entry and global leaderboard operations."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def get_or_create_window(
        self,
        season: str = DEFAULT_WORLD_CUP_SEASON,
        competition_code: str = WORLD_CUP_COMPETITION_CODE,
    ) -> GlobalCompetitionWindow:
        window = (
            self.db.query(GlobalCompetitionWindow)
            .filter(
                GlobalCompetitionWindow.competition_code == competition_code,
                GlobalCompetitionWindow.season == season,
            )
            .first()
        )
        if window:
            return window

        window = GlobalCompetitionWindow(
            competition_code=competition_code,
            season=season,
            canonical_lock_at_utc=DEFAULT_CANONICAL_LOCK_AT_UTC,
            is_canonical_locked=False,
            details={"mode": "world_cup_only"},
        )
        self.db.add(window)
        self.db.commit()
        self.db.refresh(window)
        return window

    def maybe_auto_lock(
        self,
        season: str = DEFAULT_WORLD_CUP_SEASON,
        competition_code: str = WORLD_CUP_COMPETITION_CODE,
    ) -> GlobalCompetitionWindow:
        window = self.get_or_create_window(season=season, competition_code=competition_code)
        if window.is_canonical_locked:
            return window

        now_utc = datetime.now(timezone.utc)
        lock_at = self._ensure_utc(window.canonical_lock_at_utc)
        if lock_at and now_utc >= lock_at:
            window.is_canonical_locked = True
            window.canonical_locked_at_utc = now_utc
            self.db.commit()
            self.db.refresh(window)
            logger.info("World Cup canonical window auto-locked for season=%s", season)

        return window

    def force_lock(
        self,
        season: str = DEFAULT_WORLD_CUP_SEASON,
        competition_code: str = WORLD_CUP_COMPETITION_CODE,
    ) -> GlobalCompetitionWindow:
        window = self.get_or_create_window(season=season, competition_code=competition_code)
        if not window.is_canonical_locked:
            window.is_canonical_locked = True
            window.canonical_locked_at_utc = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(window)
        return window

    def _group_points_rows(self, season: str):
        total_points_expr = func.coalesce(func.sum(UserPrediction.points + UserPrediction.bonus_points), 0)
        rows = (
            self.db.query(
                UserPrediction.user_id.label("user_id"),
                UserPrediction.group_id.label("group_id"),
                total_points_expr.label("total_points"),
            )
            .join(Group, Group.id == UserPrediction.group_id)
            .join(Fixture, Fixture.fixture_id == UserPrediction.fixture_id)
            .filter(
                Group.league == WORLD_CUP_LEAGUE,
                UserPrediction.season == season,
                UserPrediction.prediction_status == PredictionStatus.PROCESSED,
                Fixture.status.in_(
                    [
                        MatchStatus.FINISHED,
                        MatchStatus.FINISHED_AET,
                        MatchStatus.FINISHED_PEN,
                    ]
                ),
            )
            .group_by(UserPrediction.user_id, UserPrediction.group_id)
            .all()
        )
        return rows

    def _user_group_points_map(self, season: str) -> Dict[int, List[Dict]]:
        per_user: Dict[int, List[Dict]] = {}
        for row in self._group_points_rows(season):
            per_user.setdefault(row.user_id, []).append(
                {"group_id": int(row.group_id), "total_points": int(row.total_points or 0)}
            )
        return per_user

    def _rivalry_wins_for_user_group(self, user_id: int, group_id: int, season: str) -> int:
        rivalries = (
            self.db.query(RivalryPair)
            .filter(
                RivalryPair.group_id == group_id,
                or_(RivalryPair.user1_id == user_id, RivalryPair.user2_id == user_id),
            )
            .all()
        )
        if not rivalries:
            return 0

        wins = 0
        for rivalry in rivalries:
            week = rivalry.assigned_week
            user_points = (
                self.db.query(func.coalesce(func.sum(UserPrediction.points + UserPrediction.bonus_points), 0))
                .filter(
                    UserPrediction.user_id == user_id,
                    UserPrediction.group_id == group_id,
                    UserPrediction.week == week,
                    UserPrediction.season == season,
                    UserPrediction.prediction_status == PredictionStatus.PROCESSED,
                )
                .scalar()
            ) or 0

            opponent_id = rivalry.user2_id if rivalry.user1_id == user_id else rivalry.user1_id
            opponent_points = (
                self.db.query(func.coalesce(func.sum(UserPrediction.points + UserPrediction.bonus_points), 0))
                .filter(
                    UserPrediction.user_id == opponent_id,
                    UserPrediction.group_id == group_id,
                    UserPrediction.week == week,
                    UserPrediction.season == season,
                    UserPrediction.prediction_status == PredictionStatus.PROCESSED,
                )
                .scalar()
            ) or 0

            if user_points > opponent_points:
                wins += 1
        return wins

    def refresh_canonical_entries(
        self,
        season: str = DEFAULT_WORLD_CUP_SEASON,
        competition_code: str = WORLD_CUP_COMPETITION_CODE,
    ) -> Dict:
        window = self.maybe_auto_lock(season=season, competition_code=competition_code)
        user_group_points = self._user_group_points_map(season)

        created_count = 0
        updated_count = 0
        skipped_locked_count = 0

        for user_id, groups in user_group_points.items():
            groups_sorted = sorted(groups, key=lambda g: g["total_points"], reverse=True)
            best_group = groups_sorted[0]

            existing = (
                self.db.query(GlobalCanonicalEntry)
                .filter(
                    GlobalCanonicalEntry.user_id == user_id,
                    GlobalCanonicalEntry.competition_code == competition_code,
                    GlobalCanonicalEntry.season == season,
                )
                .first()
            )

            if existing and existing.is_locked:
                skipped_locked_count += 1
                source_group_id = existing.source_group_id
                total_points = next(
                    (g["total_points"] for g in groups if g["group_id"] == source_group_id),
                    existing.total_points_snapshot,
                )
                rivalry_wins = self._rivalry_wins_for_user_group(user_id, source_group_id, season)
                existing.total_points_snapshot = int(total_points)
                existing.tie_break_rivalries_won = int(rivalry_wins)
                existing.details = {
                    "mode": "world_cup_only",
                    "lock_behavior": "source_group_frozen_points_live",
                }
                updated_count += 1
                continue

            selected_group_id = int(best_group["group_id"])
            selected_points = int(best_group["total_points"])
            selected_rivalry_wins = self._rivalry_wins_for_user_group(user_id, selected_group_id, season)
            should_lock = bool(window.is_canonical_locked)
            lock_time = datetime.now(timezone.utc) if should_lock else None

            if existing:
                existing.source_group_id = selected_group_id
                existing.total_points_snapshot = selected_points
                existing.tie_break_rivalries_won = int(selected_rivalry_wins)
                existing.is_locked = should_lock
                existing.locked_at = lock_time
                existing.details = {"mode": "world_cup_only"}
                updated_count += 1
            else:
                self.db.add(
                    GlobalCanonicalEntry(
                        user_id=user_id,
                        source_group_id=selected_group_id,
                        competition_code=competition_code,
                        season=season,
                        is_locked=should_lock,
                        locked_at=lock_time,
                        tie_break_rivalries_won=int(selected_rivalry_wins),
                        total_points_snapshot=selected_points,
                        details={"mode": "world_cup_only"},
                    )
                )
                created_count += 1

        self.db.commit()

        return {
            "window_locked": window.is_canonical_locked,
            "created": created_count,
            "updated": updated_count,
            "skipped_locked": skipped_locked_count,
        }

    def get_global_leaderboard(
        self,
        season: str = DEFAULT_WORLD_CUP_SEASON,
        competition_code: str = WORLD_CUP_COMPETITION_CODE,
        limit: int = 200,
    ) -> List[Dict]:
        self.refresh_canonical_entries(season=season, competition_code=competition_code)

        rows = (
            self.db.query(
                GlobalCanonicalEntry.user_id,
                User.username,
                GlobalCanonicalEntry.source_group_id,
                Group.name.label("source_group_name"),
                GlobalCanonicalEntry.total_points_snapshot,
                GlobalCanonicalEntry.tie_break_rivalries_won,
                GlobalCanonicalEntry.is_locked,
            )
            .join(User, User.id == GlobalCanonicalEntry.user_id)
            .join(Group, Group.id == GlobalCanonicalEntry.source_group_id)
            .filter(
                GlobalCanonicalEntry.competition_code == competition_code,
                GlobalCanonicalEntry.season == season,
            )
            .order_by(
                GlobalCanonicalEntry.total_points_snapshot.desc(),
                GlobalCanonicalEntry.tie_break_rivalries_won.desc(),
                User.username.asc(),
            )
            .limit(limit)
            .all()
        )

        leaderboard: List[Dict] = []
        for idx, row in enumerate(rows, start=1):
            leaderboard.append(
                {
                    "rank": idx,
                    "user_id": int(row.user_id),
                    "username": row.username,
                    "source_group_id": int(row.source_group_id),
                    "source_group_name": row.source_group_name,
                    "total_points": int(row.total_points_snapshot or 0),
                    "rivalry_wins": int(row.tie_break_rivalries_won or 0),
                    "canonical_locked": bool(row.is_locked),
                }
            )
        return leaderboard
