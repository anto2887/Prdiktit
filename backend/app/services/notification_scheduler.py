import json
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Set, Tuple

from sqlalchemy.orm import Session

from ..db.session import SessionLocal
from ..db.models import (
    Fixture,
    Group,
    MatchStatus,
    UserNotificationPreferences,
    Team,
    TeamTracker,
    User,
    UserPrediction,
    group_members,
)
from .cache_service import cache_instance

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """
    Handles Redis-backed notification queuing and delivery:
    - Batches/reminders for upcoming fixtures
    - Match result notifications
    - Queue processing with retries
    """

    def __init__(self) -> None:
        # Reuse the existing Redis connection from cache_service
        self.redis = cache_instance.redis_client

    @staticmethod
    def _norm_team_name(name: str) -> str:
        return (name or "").strip().casefold()

    @staticmethod
    def _get_member_ids_for_group(db: Session, group: Group) -> Set[int]:
        member_ids = {
            row[0]
            for row in db.query(group_members.c.user_id)
            .filter(group_members.c.group_id == group.id)
            .all()
        }
        member_ids.add(group.admin_id)
        return member_ids

    # ------------------------------------------------------------------ #
    # REMINDER BATCHING — core anti-spam logic
    # ------------------------------------------------------------------ #

    def check_and_queue_reminders(self) -> None:
        """
        Called periodically by background_tasks.py.

        BATCHING RULE:
        A user with multiple matches on the same day gets ONE email per reminder
        type (24h or 1h), not one per match. The email lists all matches for
        that day. Timing is driven by the earliest kickoff in the batch.
        """
        if not self.redis:
            logger.warning("Redis not available — skipping reminder check")
            return

        now = datetime.now(timezone.utc)
        db = SessionLocal()
        try:
            windows: List[Dict[str, Any]] = [
                {
                    "type": "24h",
                    "start": now + timedelta(hours=23),
                    "end": now + timedelta(hours=25),
                },
                {
                    "type": "1h",
                    "start": now + timedelta(minutes=50),
                    "end": now + timedelta(minutes=70),
                },
            ]

            teams_by_id = {
                t.id: t.team_name
                for t in db.query(Team).all()
            }

            user_league_teams: Dict[int, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
            user_league_groups: Dict[int, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))

            groups = db.query(Group).all()
            for group in groups:
                tracked_ids = [
                    row[0]
                    for row in db.query(TeamTracker.team_id)
                    .filter(TeamTracker.group_id == group.id)
                    .all()
                ]
                tracked_names = {
                    self._norm_team_name(teams_by_id[tid])
                    for tid in tracked_ids
                    if tid in teams_by_id
                }
                if not tracked_names:
                    continue

                member_ids = self._get_member_ids_for_group(db, group)

                for user_id in member_ids:
                    user_league_groups[user_id][group.league].add(group.name)
                    user_league_teams[user_id][group.league].update(tracked_names)

            users_by_id = {
                u.id: u
                for u in db.query(User).filter(User.email.isnot(None)).all()
            }

            for window in windows:
                window_type = window["type"]
                window_start = window["start"]
                window_end = window["end"]

                fixtures = (
                    db.query(Fixture)
                    .filter(
                        Fixture.status == MatchStatus.NOT_STARTED,
                        Fixture.date >= window_start,
                        Fixture.date <= window_end,
                    )
                    .all()
                )

                if not fixtures:
                    continue

                by_league: Dict[str, List[Fixture]] = defaultdict(list)
                for fixture in fixtures:
                    by_league[fixture.league].append(fixture)

                for user_id, leagues in user_league_teams.items():
                    user = users_by_id.get(user_id)
                    if not user:
                        continue

                    for league_name, tracked_teams in leagues.items():
                        league_fixtures = by_league.get(league_name, [])
                        if not league_fixtures:
                            continue

                        matched = []
                        for fixture in league_fixtures:
                            home = self._norm_team_name(fixture.home_team)
                            away = self._norm_team_name(fixture.away_team)
                            if home in tracked_teams or away in tracked_teams:
                                matched.append(fixture)

                        if not matched:
                            continue

                        date_str = min(f.date for f in matched).strftime("%Y-%m-%d")
                        dedup_key = (
                            f"notif:queued:reminder:{user.id}:{league_name}:{date_str}:{window_type}"
                        )

                        # SETNX — skip if already queued
                        if not self.redis.setnx(dedup_key, "1"):
                            continue

                        # Set TTL on the dedup key (25 hours)
                        self.redis.expire(dedup_key, 25 * 3600)

                        job = {
                            "type": f"reminder_{window_type}",
                            "user_id": user.id,
                            "payload": {
                                "league": league_name,
                                "group_names": sorted(
                                    user_league_groups.get(user.id, {})
                                    .get(league_name, set())
                                ),
                                "fixture_ids": [f.fixture_id for f in matched],
                                "date_str": date_str,
                                "hours_until": int(
                                    window_type.replace("h", "")
                                ),
                            },
                            "created_at": now.isoformat(),
                            "retry_count": 0,
                        }
                        self.redis.lpush("notif:jobs", json.dumps(job))

        except Exception as e:
            logger.error(f"check_and_queue_reminders error: {e}")
        finally:
            db.close()

    # ------------------------------------------------------------------ #
    # QUEUE PROCESSOR
    # ------------------------------------------------------------------ #

    async def process_notification_queue(self) -> None:
        """
        Called periodically by background_tasks.py.
        Pops up to 50 jobs from notif:jobs and processes each one.
        Failed jobs are retried up to 2 times, then discarded.
        """
        if not self.redis:
            return

        db = SessionLocal()
        try:
            for _ in range(50):
                raw = self.redis.rpop("notif:jobs")
                if not raw:
                    break

                try:
                    job = json.loads(raw)
                    await self._process_single_job(job, db)
                except Exception as e:
                    logger.error(f"Job processing error: {e} — raw: {raw}")

        finally:
            db.close()

    async def _process_single_job(self, job: Dict[str, Any], db: Session) -> None:
        """
        Process a single job from the notification queue.
        Executes async notification sends for reminder and result digest jobs.
        """
        from .notification_service import NotificationService

        job_type = job.get("type")
        user_id = job.get("user_id")
        payload = job.get("payload", {})
        retry_count = job.get("retry_count", 0)

        notif = NotificationService(db)

        try:
            if job_type in ("reminder_24h", "reminder_1h"):
                hours = int(job_type.replace("reminder_", "").replace("h", ""))
                fixture_ids = payload.get("fixture_ids", [])
                league_name = payload.get("league")
                group_names = payload.get("group_names", [])
                fixtures = (
                    db.query(Fixture)
                    .filter(Fixture.fixture_id.in_(fixture_ids))
                    .all()
                )
                if fixtures:
                    await notif.send_prediction_reminder(
                        user_id,
                        fixtures,
                        hours,
                        league_name=league_name,
                        group_names=group_names,
                    )

            elif job_type == "match_result_digest":
                entries: List[Dict[str, Any]] = []
                items = payload.get("items", [])
                league_name = payload.get("league")
                group_names = payload.get("group_names", [])
                prediction_ids_to_mark: List[int] = []

                for item in items:
                    fixture = (
                        db.query(Fixture)
                        .filter_by(fixture_id=item["fixture_id"])
                        .first()
                    )
                    prediction = (
                        db.query(UserPrediction)
                        .filter_by(id=item["prediction_id"])
                        .first()
                    )
                    if fixture and prediction:
                        entries.append(
                            {
                                "fixture": fixture,
                                "prediction": prediction,
                                "points_earned": int(item.get("points_earned", 0)),
                            }
                        )
                        prediction_ids_to_mark.append(prediction.id)

                if entries:
                    sent = await notif.send_match_result_digest(
                        user_id=user_id,
                        entries=entries,
                        league_name=league_name,
                        group_names=group_names,
                    )
                    if sent and prediction_ids_to_mark:
                        (
                            db.query(UserPrediction)
                            .filter(UserPrediction.id.in_(prediction_ids_to_mark))
                            .update(
                                {"result_notified_at": datetime.now(timezone.utc)},
                                synchronize_session=False,
                            )
                        )
                        db.commit()

        except Exception as e:
            logger.error(f"Job failed (attempt {retry_count + 1}): {e}")
            if retry_count < 2:
                job["retry_count"] = retry_count + 1
                self.redis.lpush("notif:jobs", json.dumps(job))
            else:
                logger.error(f"Job discarded after 3 attempts: {job}")

    # ------------------------------------------------------------------ #
    # MATCH RESULT QUEUING
    # ------------------------------------------------------------------ #

    def check_and_queue_match_results(self) -> None:
        """
        Called periodically by background_tasks.py.
        Finds recently PROCESSED predictions and queues result notification jobs.
        Uses dedup key to prevent double-sending.
        """
        if not self.redis:
            return

        now = datetime.now(timezone.utc)

        db = SessionLocal()
        try:
            from ..db.models import PredictionStatus

            recent = (
                db.query(UserPrediction)
                .join(User, User.id == UserPrediction.user_id)
                .join(
                    UserNotificationPreferences,
                    UserNotificationPreferences.user_id == UserPrediction.user_id,
                )
                .filter(
                    UserPrediction.prediction_status
                    == PredictionStatus.PROCESSED,
                    UserPrediction.result_notified_at.is_(None),
                    User.email.isnot(None),
                    UserNotificationPreferences.email_enabled.is_(True),
                    UserNotificationPreferences.match_result_updates.is_(True),
                )
                .all()
            )

            digest_buckets: Dict[Tuple[int, str], Dict[str, Any]] = defaultdict(
                lambda: {"items": [], "group_names": set()}
            )

            for prediction in recent:
                fixture = (
                    db.query(Fixture)
                    .filter(Fixture.fixture_id == prediction.fixture_id)
                    .first()
                )
                if not fixture:
                    continue

                dedup_key = (
                    f"notif:queued:result:{prediction.user_id}:{prediction.fixture_id}"
                )
                if not self.redis.setnx(dedup_key, "1"):
                    continue
                self.redis.expire(dedup_key, 48 * 3600)

                bucket = digest_buckets[(prediction.user_id, fixture.league)]
                bucket["items"].append(
                    {
                        "fixture_id": prediction.fixture_id,
                        "prediction_id": prediction.id,
                        "points_earned": prediction.points or 0,
                    }
                )
                if prediction.group_id:
                    group = db.query(Group).filter(Group.id == prediction.group_id).first()
                    if group and group.name:
                        bucket["group_names"].add(group.name)

            for (user_id, league_name), digest in digest_buckets.items():
                items = digest["items"]
                if not items:
                    continue
                job = {
                    "type": "match_result_digest",
                    "user_id": user_id,
                    "payload": {
                        "league": league_name,
                        "group_names": sorted(digest["group_names"]),
                        "items": items,
                    },
                    "created_at": now.isoformat(),
                    "retry_count": 0,
                }
                self.redis.lpush("notif:jobs", json.dumps(job))

        except Exception as e:
            logger.error(f"check_and_queue_match_results error: {e}")
        finally:
            db.close()


# Module-level singleton — imported by background_tasks.py
notification_scheduler = NotificationScheduler()

