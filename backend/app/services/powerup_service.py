import logging
from datetime import date, datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db.models import (
    PowerUpCatalog,
    PowerUpActivation,
    PowerUpDailyEffect,
    PowerUpType,
    PowerUpStatus,
    CoinTransactionType,
)
from .coin_service import CoinService

logger = logging.getLogger(__name__)


class PowerUpService:
    DEFAULT_COSTS = {
        PowerUpType.SHIELD: 300,
        PowerUpType.FREEZE: 200,
        PowerUpType.MULTIPLIER: 100,
    }

    @staticmethod
    def _ensure_catalog_seeded(db: Session) -> None:
        for p_type, cost in PowerUpService.DEFAULT_COSTS.items():
            existing = db.query(PowerUpCatalog).filter(
                PowerUpCatalog.powerup_type == p_type
            ).first()
            if existing:
                continue
            db.add(
                PowerUpCatalog(
                    powerup_type=p_type,
                    display_name=p_type.value.capitalize(),
                    description=f"{p_type.value.capitalize()} power-up",
                    base_cost_coins=cost,
                    is_enabled=True,
                )
            )
        db.flush()

    @staticmethod
    def list_catalog(db: Session):
        PowerUpService._ensure_catalog_seeded(db)
        rows = db.query(PowerUpCatalog).all()
        return rows

    @staticmethod
    def _is_user_in_group(db: Session, user_id: int, group_id: int) -> bool:
        result = db.execute(
            text(
                """
                SELECT COUNT(*) FROM group_members
                WHERE user_id = :user_id AND group_id = :group_id
                """
            ),
            {"user_id": user_id, "group_id": group_id},
        ).scalar()
        return int(result or 0) > 0

    @staticmethod
    def _normalize_target_for_type(
        powerup_type: PowerUpType,
        purchaser_user_id: int,
        target_user_id: Optional[int],
    ) -> int:
        # Shield and multiplier are self-targeting in this release.
        if powerup_type in (PowerUpType.SHIELD, PowerUpType.MULTIPLIER):
            return purchaser_user_id
        if target_user_id is None:
            raise ValueError("target_user_id is required for freeze")
        return target_user_id

    @staticmethod
    def _validate_type_specific_rules(
        db: Session,
        *,
        powerup_type: PowerUpType,
        source_group_id: int,
        target_user_id: int,
        effective_utc_date: date,
        fixture_id: Optional[int],
    ) -> None:
        # No-stacking rule set:
        # - shield: one per user/day/group
        # - freeze: effect doesn't stack (duplicates allowed/charged)
        # - multiplier: one per user/day/group
        if powerup_type == PowerUpType.MULTIPLIER:
            if fixture_id is None:
                raise ValueError("fixture_id is required for multiplier")
            existing_multiplier = db.query(PowerUpDailyEffect).filter(
                PowerUpDailyEffect.user_id == target_user_id,
                PowerUpDailyEffect.source_group_id == source_group_id,
                PowerUpDailyEffect.effective_utc_date == effective_utc_date,
                PowerUpDailyEffect.powerup_type == PowerUpType.MULTIPLIER,
            ).first()
            if existing_multiplier:
                raise ValueError("Only one multiplier can be active per user per day")

        if powerup_type == PowerUpType.SHIELD:
            existing_shield = db.query(PowerUpDailyEffect).filter(
                PowerUpDailyEffect.user_id == target_user_id,
                PowerUpDailyEffect.source_group_id == source_group_id,
                PowerUpDailyEffect.effective_utc_date == effective_utc_date,
                PowerUpDailyEffect.powerup_type == PowerUpType.SHIELD,
            ).first()
            if existing_shield:
                raise ValueError("Only one shield can be active per user per day")

    @staticmethod
    def activate_powerup(
        db: Session,
        *,
        purchaser_user_id: int,
        powerup_type: PowerUpType,
        source_group_id: int,
        effective_utc_date: date,
        target_user_id: Optional[int] = None,
        fixture_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        PowerUpService._ensure_catalog_seeded(db)

        if not PowerUpService._is_user_in_group(db, purchaser_user_id, source_group_id):
            raise ValueError("Purchaser must belong to source group")

        target_user_id = PowerUpService._normalize_target_for_type(
            powerup_type, purchaser_user_id, target_user_id
        )

        catalog_entry = db.query(PowerUpCatalog).filter(
            PowerUpCatalog.powerup_type == powerup_type,
            PowerUpCatalog.is_enabled.is_(True),
        ).first()
        if not catalog_entry:
            raise ValueError(f"Power-up type {powerup_type.value} is not available")

        PowerUpService._validate_type_specific_rules(
            db,
            powerup_type=powerup_type,
            source_group_id=source_group_id,
            target_user_id=target_user_id,
            effective_utc_date=effective_utc_date,
            fixture_id=fixture_id,
        )

        target_in_source_group = PowerUpService._is_user_in_group(db, target_user_id, source_group_id)
        cost_multiplier = 1 if target_in_source_group else 2
        base_cost = int(catalog_entry.base_cost_coins)
        charged_cost = base_cost * cost_multiplier

        activation_ref = f"powerup:{purchaser_user_id}:{powerup_type.value}:{datetime.now(timezone.utc).isoformat()}"
        debit_result = CoinService.debit_coins(
            db,
            user_id=purchaser_user_id,
            amount_coins=charged_cost,
            transaction_type=CoinTransactionType.DEBIT_POWERUP,
            external_ref=activation_ref,
            details={
                "powerup_type": powerup_type.value,
                "target_user_id": target_user_id,
                "source_group_id": source_group_id,
                "effective_utc_date": effective_utc_date.isoformat(),
                "cost_multiplier": cost_multiplier,
                "base_cost_coins": base_cost,
                "charged_cost_coins": charged_cost,
            },
        )

        activation = PowerUpActivation(
            purchaser_user_id=purchaser_user_id,
            target_user_id=target_user_id,
            source_group_id=source_group_id,
            fixture_id=fixture_id,
            powerup_type=powerup_type,
            effective_utc_date=effective_utc_date,
            status=PowerUpStatus.APPLIED,
            cost_multiplier=cost_multiplier,
            base_cost_coins=base_cost,
            charged_cost_coins=charged_cost,
            ledger_entry_id=debit_result["ledger_entry_id"],
            details={"target_in_source_group": target_in_source_group},
        )
        db.add(activation)
        db.flush()

        existing_effect = db.query(PowerUpDailyEffect).filter(
            PowerUpDailyEffect.user_id == target_user_id,
            PowerUpDailyEffect.source_group_id == source_group_id,
            PowerUpDailyEffect.effective_utc_date == effective_utc_date,
            PowerUpDailyEffect.powerup_type == powerup_type,
            PowerUpDailyEffect.fixture_id == (fixture_id if powerup_type == PowerUpType.MULTIPLIER else None),
        ).first()

        duplicate_effect = existing_effect is not None
        effect_applied = not duplicate_effect
        if effect_applied:
            db.add(
                PowerUpDailyEffect(
                    user_id=target_user_id,
                    source_group_id=source_group_id,
                    effective_utc_date=effective_utc_date,
                    powerup_type=powerup_type,
                    fixture_id=fixture_id if powerup_type == PowerUpType.MULTIPLIER else None,
                    activation_id=activation.id,
                )
            )
            db.flush()

        db.commit()

        return {
            "activation_id": activation.id,
            "powerup_type": powerup_type.value,
            "target_user_id": target_user_id,
            "source_group_id": source_group_id,
            "effective_utc_date": effective_utc_date.isoformat(),
            "cost_multiplier": cost_multiplier,
            "base_cost_coins": base_cost,
            "charged_cost_coins": charged_cost,
            "balance_after": debit_result["balance_after"],
            "effect_applied": effect_applied,
            "duplicate_effect": duplicate_effect,
        }
