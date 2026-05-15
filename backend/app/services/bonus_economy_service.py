"""Welcome and referral coin grants (idempotent)."""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..db.models import CoinTransactionType
from .coin_service import CoinService

logger = logging.getLogger(__name__)

WELCOME_COINS = 100
REFERRER_REWARD_COINS = 100
REFERRED_EXTRA_COINS = 25


class BonusEconomyService:
    @staticmethod
    def grant_new_user_promotions(
        db: Session,
        *,
        new_user_id: int,
        referred_by_user_id: Optional[int],
    ) -> None:
        """
        Grant welcome coins to every new user; if referred, grant referree + referrer bonuses.
        All credits are idempotent — safe to retry.
        """
        welcome_key = f"welcome_bonus:user:{new_user_id}"
        CoinService.credit_coins_idempotent(
            db,
            user_id=new_user_id,
            amount_coins=WELCOME_COINS,
            idempotency_key=welcome_key,
            transaction_type=CoinTransactionType.CREDIT_PROMO,
            details={"reason": "welcome"},
        )

        if not referred_by_user_id or referred_by_user_id == new_user_id:
            return

        referrer_key = f"referrer_bonus:referree:{new_user_id}"
        CoinService.credit_coins_idempotent(
            db,
            user_id=referred_by_user_id,
            amount_coins=REFERRER_REWARD_COINS,
            idempotency_key=referrer_key,
            transaction_type=CoinTransactionType.CREDIT_PROMO,
            details={"reason": "referral_referrer", "referree_user_id": new_user_id},
        )

        referred_extra_key = f"referral_referred_extra:user:{new_user_id}"
        CoinService.credit_coins_idempotent(
            db,
            user_id=new_user_id,
            amount_coins=REFERRED_EXTRA_COINS,
            idempotency_key=referred_extra_key,
            transaction_type=CoinTransactionType.CREDIT_PROMO,
            details={"reason": "referral_referred", "referrer_user_id": referred_by_user_id},
        )
