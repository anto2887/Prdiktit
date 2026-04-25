import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.dependencies import get_current_active_user_from_session
from ..db.models import User
from ..db.session_manager import get_db
from ..services.coin_service import CoinService
from ..services.payment_service import PaymentService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["payments"])


class CreateCheckoutSessionRequest(BaseModel):
    bundle_id: str = Field(..., min_length=1)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)


@router.get("/coin-bundles")
async def list_coin_bundles(
    current_user: User = Depends(get_current_active_user_from_session),
):
    try:
        bundles = PaymentService.get_coin_bundles()
        return {
            "success": True,
            "data": [
                {
                    "bundle_id": b.bundle_id,
                    "price_id": b.price_id,
                    "coins": b.coins,
                    "label": b.label,
                    "tier": b.tier,
                    "currency": b.currency,
                }
                for b in bundles
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list bundles: {exc}") from exc


@router.get("/wallet")
async def get_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session),
):
    balance = CoinService.get_wallet_balance(db, current_user.id)
    return {"success": True, "data": {"balance_coins": balance}}


@router.post("/checkout-session")
async def create_checkout_session(
    payload: CreateCheckoutSessionRequest,
    current_user: User = Depends(get_current_active_user_from_session),
):
    try:
        session = PaymentService.create_checkout_session(
            user_id=current_user.id,
            bundle_id=payload.bundle_id,
            country_code=payload.country_code,
        )
        return {"success": True, "data": session}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Failed to create checkout session: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create checkout session",
        ) from exc


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    try:
        event = PaymentService.verify_webhook_payload(payload, signature)
    except Exception as exc:
        logger.warning("Webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc

    to_dict = getattr(event, "to_dict_recursive", None)
    normalized_event = to_dict() if callable(to_dict) else event
    event_type = PaymentService._safe_get(normalized_event, "type")
    if event_type == "checkout.session.completed":
        try:
            result = PaymentService.handle_checkout_session_completed(db, normalized_event)
            return {"success": True, "event_type": event_type, "result": result}
        except Exception as exc:
            db.rollback()
            logger.error("Failed processing checkout completion: %s", exc)
            raise HTTPException(status_code=500, detail="Webhook processing failed") from exc

    return {"success": True, "event_type": event_type, "ignored": True}
