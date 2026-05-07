import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.dependencies import get_current_active_user_from_session
from ..db.models import User, PowerUpType
from ..db.session_manager import get_db
from ..services.powerup_service import PowerUpService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["powerups"])


class ActivatePowerUpRequest(BaseModel):
    powerup_type: PowerUpType
    source_group_id: int
    effective_utc_date: Optional[str] = None  # YYYY-MM-DD
    target_user_id: Optional[int] = None
    fixture_id: Optional[int] = None


class PurchasePowerUpRequest(BaseModel):
    powerup_type: PowerUpType
    quantity: int = Field(default=1, ge=1)


@router.get("/catalog")
async def get_powerup_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session),
):
    rows = PowerUpService.list_catalog(db)
    return {
        "success": True,
        "data": [
            {
                "powerup_type": row.powerup_type.value,
                "display_name": row.display_name,
                "description": row.description,
                "base_cost_coins": row.base_cost_coins,
                "is_enabled": row.is_enabled,
            }
            for row in rows
        ],
    }


@router.get("/inventory")
async def get_powerup_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session),
):
    rows = PowerUpService.list_inventory(db, user_id=current_user.id)
    return {"success": True, "data": rows}


@router.post("/purchase")
async def purchase_powerup(
    payload: PurchasePowerUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session),
):
    try:
        result = PowerUpService.purchase_powerup(
            db,
            user_id=current_user.id,
            powerup_type=payload.powerup_type,
            quantity=payload.quantity,
        )
        return {"success": True, "data": result}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Power-up purchase failed: %s", exc)
        db.rollback()
        raise HTTPException(status_code=500, detail="Power-up purchase failed") from exc


@router.post("/activate")
async def activate_powerup(
    payload: ActivatePowerUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session),
):
    try:
        if payload.effective_utc_date:
            effective_date = datetime.strptime(payload.effective_utc_date, "%Y-%m-%d").date()
        else:
            effective_date = datetime.now(timezone.utc).date()

        result = PowerUpService.activate_powerup(
            db,
            purchaser_user_id=current_user.id,
            powerup_type=payload.powerup_type,
            source_group_id=payload.source_group_id,
            effective_utc_date=effective_date,
            target_user_id=payload.target_user_id,
            fixture_id=payload.fixture_id,
        )
        return {"success": True, "data": result}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Power-up activation failed: %s", exc)
        db.rollback()
        raise HTTPException(status_code=500, detail="Power-up activation failed") from exc
