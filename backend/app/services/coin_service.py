import logging
from decimal import Decimal
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from ..db.models import (
    UserWallet,
    CoinLedgerEntry,
    CoinTransactionType,
)

logger = logging.getLogger(__name__)


class CoinService:
    """Wallet and coin-ledger operations."""

    @staticmethod
    def get_or_create_wallet(db: Session, user_id: int) -> UserWallet:
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if wallet:
            return wallet

        wallet = UserWallet(user_id=user_id, balance_coins=0)
        db.add(wallet)
        db.flush()
        return wallet

    @staticmethod
    def get_wallet_balance(db: Session, user_id: int) -> int:
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        return wallet.balance_coins if wallet else 0

    @staticmethod
    def credit_coins_idempotent(
        db: Session,
        *,
        user_id: int,
        amount_coins: int,
        idempotency_key: str,
        transaction_type: CoinTransactionType = CoinTransactionType.CREDIT_PURCHASE,
        external_ref: Optional[str] = None,
        currency: Optional[str] = None,
        amount_money: Optional[Decimal] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Credit coins exactly once for the given idempotency key."""
        if amount_coins <= 0:
            raise ValueError("amount_coins must be positive for credit")

        existing = db.query(CoinLedgerEntry).filter(
            CoinLedgerEntry.idempotency_key == idempotency_key
        ).first()
        if existing:
            logger.info("Idempotent credit hit for key=%s", idempotency_key)
            return {
                "credited": False,
                "already_processed": True,
                "balance_after": existing.balance_after,
                "ledger_entry_id": existing.id,
            }

        wallet = CoinService.get_or_create_wallet(db, user_id)
        wallet.balance_coins += amount_coins
        wallet.lifetime_purchased_coins += amount_coins

        ledger = CoinLedgerEntry(
            user_id=user_id,
            wallet_id=wallet.id,
            transaction_type=transaction_type,
            amount_coins=amount_coins,
            balance_after=wallet.balance_coins,
            idempotency_key=idempotency_key,
            external_ref=external_ref,
            currency=currency,
            amount_money=amount_money,
            details=details,
        )
        db.add(ledger)
        db.flush()

        return {
            "credited": True,
            "already_processed": False,
            "balance_after": wallet.balance_coins,
            "ledger_entry_id": ledger.id,
        }

    @staticmethod
    def debit_coins(
        db: Session,
        *,
        user_id: int,
        amount_coins: int,
        transaction_type: CoinTransactionType = CoinTransactionType.DEBIT_POWERUP,
        external_ref: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Debit coins from wallet. Raises ValueError if insufficient balance."""
        if amount_coins <= 0:
            raise ValueError("amount_coins must be positive for debit")

        wallet = CoinService.get_or_create_wallet(db, user_id)
        if wallet.balance_coins < amount_coins:
            raise ValueError("Insufficient coin balance")

        wallet.balance_coins -= amount_coins
        wallet.lifetime_spent_coins += amount_coins

        ledger = CoinLedgerEntry(
            user_id=user_id,
            wallet_id=wallet.id,
            transaction_type=transaction_type,
            amount_coins=-amount_coins,
            balance_after=wallet.balance_coins,
            external_ref=external_ref,
            details=details,
        )
        db.add(ledger)
        db.flush()

        return {
            "debited": True,
            "balance_after": wallet.balance_coins,
            "ledger_entry_id": ledger.id,
        }
