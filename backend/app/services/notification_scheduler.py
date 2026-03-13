import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from sqlalchemy.orm import Session

from ..db.session import SessionLocal
from ..db.models import Fixture, UserPrediction, UserNotificationPreferences, User, MatchStatus
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

                # Group by UTC calendar date
                by_date: Dict[str, List[Fixture]] = {}
                for f in fixtures:
                    date_str = f.date.strftime("%Y-%m-%d")
                    by_date.setdefault(date_str, []).append(f)

                # For now, notify all users with an email address;
                # if group-scoping is needed later, this is the place to refine it.
                users = db.query(User).filter(User.email.isnot(None)).all()

                for date_str, day_fixtures in by_date.items():
                    for user in users:
                        dedup_key = (
                            f"notif:queued:reminder:{user.id}:{date_str}:{window_type}"
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
                                "fixture_ids": [
                                    f.fixture_id for f in day_fixtures
                                ],
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
        Uses asyncio.run to execute async notification sends in a fresh event loop.
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
                fixtures = (
                    db.query(Fixture)
                    .filter(Fixture.fixture_id.in_(fixture_ids))
                    .all()
                )
                if fixtures:
                    await notif.send_prediction_reminder(user_id, fixtures, hours)

            elif job_type == "match_result":
                fixture = (
                    db.query(Fixture)
                    .filter_by(fixture_id=payload["fixture_id"])
                    .first()
                )
                prediction = (
                    db.query(UserPrediction)
                    .filter_by(id=payload["prediction_id"])
                    .first()
                )
                if fixture and prediction:
                    await notif.send_match_result(
                        user_id,
                        fixture,
                        prediction,
                        payload["points_earned"],
                    )

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
        lookback = now - timedelta(minutes=10)

        db = SessionLocal()
        try:
            from ..db.models import PredictionStatus

            recent = (
                db.query(UserPrediction)
                .filter(
                    UserPrediction.prediction_status
                    == PredictionStatus.PROCESSED,
                    UserPrediction.processed_at >= lookback,
                )
                .all()
            )

            for prediction in recent:
                dedup_key = (
                    f"notif:queued:result:{prediction.user_id}:{prediction.fixture_id}"
                )
                if not self.redis.setnx(dedup_key, "1"):
                    continue
                self.redis.expire(dedup_key, 48 * 3600)

                job = {
                    "type": "match_result",
                    "user_id": prediction.user_id,
                    "payload": {
                        "fixture_id": prediction.fixture_id,
                        "prediction_id": prediction.id,
                        "points_earned": prediction.points or 0,
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

