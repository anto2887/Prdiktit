import json
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Optional, Any

import stripe
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db.models import CoinTransactionType
from .coin_service import CoinService

logger = logging.getLogger(__name__)


@dataclass
class CoinBundle:
    bundle_id: str
    price_id: str
    coins: int
    label: Optional[str] = None
    tier: str = "default"
    currency: str = "usd"


class PaymentService:
    """Stripe checkout and webhook fulfillment for coin purchases."""
    LATAM_COUNTRIES = {
        "AR", "BO", "BR", "CL", "CO", "CR", "DO", "EC", "GT", "HN",
        "MX", "NI", "PA", "PE", "PY", "SV", "UY", "VE",
    }
    EMERGING_COUNTRIES = {
        "BD", "ET", "GH", "ID", "IN", "KE", "MM", "NG", "NP", "PK",
        "TZ", "UG", "VN", "ZA",
    }

    @staticmethod
    def _to_plain_dict(obj: Any) -> Dict[str, Any]:
        """Convert Stripe SDK objects to plain dicts safely."""
        if isinstance(obj, dict):
            return obj
        to_dict = getattr(obj, "to_dict_recursive", None)
        if callable(to_dict):
            return to_dict()
        # Fallback: best-effort cast
        return dict(obj)

    @staticmethod
    def _ensure_stripe_configured() -> None:
        if not settings.STRIPE_SECRET_KEY:
            raise ValueError("STRIPE_SECRET_KEY is not configured")
        stripe.api_key = settings.STRIPE_SECRET_KEY

    @staticmethod
    def get_coin_bundles() -> List[CoinBundle]:
        raw = settings.STRIPE_COIN_BUNDLES_JSON or "[]"
        parsed = json.loads(raw)
        bundles: List[CoinBundle] = []
        # Backward-compatible legacy format: [{bundle_id, price_id, coins, label}]
        if isinstance(parsed, list):
            for item in parsed:
                bundles.append(
                    CoinBundle(
                        bundle_id=item["bundle_id"],
                        price_id=item["price_id"],
                        coins=int(item["coins"]),
                        label=item.get("label"),
                        tier="default",
                        currency=item.get("currency", "usd"),
                    )
                )
            return bundles

        # Tiered format:
        # {"bundles":{"coins_100":{"coins":100,"tiers":{"default":{"price_id":"...","currency":"usd"}}}}}
        bundle_map = parsed.get("bundles", {})
        for bundle_id, bundle_cfg in bundle_map.items():
            coins = int(bundle_cfg["coins"])
            tiers = bundle_cfg.get("tiers", {})
            for tier_name, tier_cfg in tiers.items():
                bundles.append(
                    CoinBundle(
                        bundle_id=bundle_id,
                        price_id=tier_cfg["price_id"],
                        coins=coins,
                        label=tier_cfg.get("label") or bundle_cfg.get("label"),
                        tier=tier_name,
                        currency=tier_cfg.get("currency", "usd"),
                    )
                )
        return bundles

    @staticmethod
    def determine_pricing_tier(country_code: Optional[str]) -> str:
        if not country_code:
            return "default"
        code = country_code.strip().upper()
        if code in PaymentService.LATAM_COUNTRIES:
            return "latam"
        if code in PaymentService.EMERGING_COUNTRIES:
            return "emerging"
        return "default"

    @staticmethod
    def get_bundle_by_id(bundle_id: str, country_code: Optional[str] = None) -> CoinBundle:
        desired_tier = PaymentService.determine_pricing_tier(country_code)
        default_candidate: Optional[CoinBundle] = None

        for bundle in PaymentService.get_coin_bundles():
            if bundle.bundle_id != bundle_id:
                continue
            if bundle.tier == desired_tier:
                return bundle
            if bundle.tier == "default":
                default_candidate = bundle

        if default_candidate:
            return default_candidate
        raise ValueError(f"Unknown bundle_id: {bundle_id}")

    @staticmethod
    def create_checkout_session(
        *,
        user_id: int,
        bundle_id: str,
        country_code: Optional[str] = None,
    ) -> Dict[str, str]:
        PaymentService._ensure_stripe_configured()
        bundle = PaymentService.get_bundle_by_id(bundle_id, country_code)
        pricing_tier = PaymentService.determine_pricing_tier(country_code)

        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": bundle.price_id, "quantity": 1}],
            success_url=settings.STRIPE_SUCCESS_URL,
            cancel_url=settings.STRIPE_CANCEL_URL,
            metadata={
                "user_id": str(user_id),
                "bundle_id": bundle.bundle_id,
                "coins": str(bundle.coins),
                "tier": bundle.tier or pricing_tier,
                "country_code": (country_code or "").upper(),
            },
        )
        return {"id": session.id, "url": session.url}

    @staticmethod
    def verify_webhook_payload(payload: bytes, signature_header: str):
        if not settings.STRIPE_WEBHOOK_SECRET:
            raise ValueError("STRIPE_WEBHOOK_SECRET is not configured")
        PaymentService._ensure_stripe_configured()
        return stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )

    @staticmethod
    def handle_checkout_session_completed(db: Session, event: Dict) -> Dict[str, object]:
        event_dict = PaymentService._to_plain_dict(event)
        data = event_dict.get("data", {})
        session_obj = PaymentService._to_plain_dict(data.get("object", {}))
        metadata = session_obj.get("metadata", {}) or {}

        user_id = int(metadata.get("user_id"))
        bundle_id = metadata.get("bundle_id")
        coins = int(metadata.get("coins"))

        payment_status = session_obj.get("payment_status")
        if payment_status != "paid":
            return {"processed": False, "reason": f"payment_status={payment_status}"}

        idempotency_key = f"stripe_checkout_completed:{session_obj['id']}"
        external_ref = session_obj.get("payment_intent") or session_obj["id"]
        currency = session_obj.get("currency")
        amount_total = session_obj.get("amount_total")
        amount_money = Decimal(amount_total) / Decimal(100) if amount_total is not None else None

        result = CoinService.credit_coins_idempotent(
            db,
            user_id=user_id,
            amount_coins=coins,
            idempotency_key=idempotency_key,
            transaction_type=CoinTransactionType.CREDIT_PURCHASE,
            external_ref=external_ref,
            currency=currency,
            amount_money=amount_money,
            details={
                "source": "stripe_checkout_session_completed",
                "bundle_id": bundle_id,
                "checkout_session_id": session_obj["id"],
            },
        )
        db.commit()

        return {
            "processed": True,
            "bundle_id": bundle_id,
            "coins": coins,
            "credit_result": result,
        }
