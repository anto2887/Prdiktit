"""
Invalidate Redis keys scoped to a group so leaderboards, analytics, and member
group lists refresh after rivalry assignment or data repair.
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from .cache_service import RedisCache
from ..db.models import group_members

logger = logging.getLogger(__name__)


async def invalidate_group_scoped_caches(
    cache: Optional[RedisCache],
    db: Session,
    group_id: int,
) -> None:
    """
    Clear cached payloads that embed group standings, activation, or week-scoped data.

    Patterns align with:
    - predictions leaderboard: leaderboard:{group_id}:*
    - analytics_service: group_analytics:{group_id}:*
    - analytics_service heatmap: group_heatmap:{group_id}:*
    - group week predictions: group_predictions:{group_id}:*
    - groups list: user_groups_enhanced:{user_id}, user_groups:{user_id}
    """
    if not cache or not getattr(cache, "redis_client", None):
        return

    patterns = [
        f"leaderboard:{group_id}:*",
        f"group_analytics:{group_id}:*",
        f"group_heatmap:{group_id}:*",
        f"group_predictions:{group_id}:*",
    ]
    for pattern in patterns:
        try:
            await cache.clear_pattern(pattern)
        except Exception as e:
            logger.warning("Cache clear_pattern failed pattern=%s: %s", pattern, e)

    try:
        member_rows = (
            db.query(group_members.c.user_id)
            .filter(group_members.c.group_id == group_id)
            .all()
        )
        for (user_id,) in member_rows:
            try:
                await cache.delete(f"user_groups_enhanced:{user_id}")
                await cache.delete(f"user_groups:{user_id}")
            except Exception as e:
                logger.warning(
                    "Cache delete failed user_groups keys user_id=%s: %s", user_id, e
                )
    except Exception as e:
        logger.warning("Member lookup for cache invalidation failed: %s", e)
