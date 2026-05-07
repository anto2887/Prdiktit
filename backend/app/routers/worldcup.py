import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.dependencies import get_current_active_user_from_session
from ..db.session_manager import get_db
from ..schemas import DataResponse, ListResponse, User
from ..services.worldcup_global_service import (
    DEFAULT_WORLD_CUP_SEASON,
    WORLD_CUP_COMPETITION_CODE,
    WorldCupGlobalService,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/global-leaderboard", response_model=ListResponse)
async def get_world_cup_global_leaderboard(
    season: str = Query(DEFAULT_WORLD_CUP_SEASON),
    limit: int = Query(200, ge=1, le=500),
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db),
):
    """World Cup global rankings from canonical entries only."""
    try:
        _ = current_user  # auth gate only
        svc = WorldCupGlobalService(db)
        rows = svc.get_global_leaderboard(
            season=season, competition_code=WORLD_CUP_COMPETITION_CODE, limit=limit
        )
        return ListResponse(data=rows, total=len(rows))
    except Exception as e:
        logger.error("Failed to load World Cup global leaderboard: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load World Cup global leaderboard",
        )


@router.get("/canonical-status", response_model=DataResponse)
async def get_world_cup_canonical_status(
    season: str = Query(DEFAULT_WORLD_CUP_SEASON),
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db),
):
    """Expose canonical lock state for World Cup UI messaging."""
    try:
        _ = current_user  # auth gate only
        svc = WorldCupGlobalService(db)
        window = svc.maybe_auto_lock(
            season=season, competition_code=WORLD_CUP_COMPETITION_CODE
        )
        return DataResponse(
            data={
                "competition_code": WORLD_CUP_COMPETITION_CODE,
                "season": season,
                "canonical_lock_at_utc": (
                    window.canonical_lock_at_utc.isoformat() if window.canonical_lock_at_utc else None
                ),
                "is_canonical_locked": bool(window.is_canonical_locked),
                "canonical_locked_at_utc": (
                    window.canonical_locked_at_utc.isoformat()
                    if window.canonical_locked_at_utc
                    else None
                ),
                "mode": "world_cup_only",
            }
        )
    except Exception as e:
        logger.error("Failed to load World Cup canonical status: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load World Cup canonical status",
        )
