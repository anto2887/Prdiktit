import logging
from datetime import date, datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db.models import (
    PowerUpCatalog,
    PowerUpActivation,
    PowerUpDailyEffect,
    UserPowerUpInventory,
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
    def _get_or_create_inventory_row(
        db: Session,
        *,
        user_id: int,
        powerup_type: PowerUpType,
    ) -> UserPowerUpInventory:
        row = db.query(UserPowerUpInventory).filter(
            UserPowerUpInventory.user_id == user_id,
            UserPowerUpInventory.powerup_type == powerup_type,
        ).first()
        if row:
            return row

        row = UserPowerUpInventory(
            user_id=user_id,
            powerup_type=powerup_type,
            quantity=0,
        )
        db.add(row)
        db.flush()
        return row

    @staticmethod
    def list_inventory(db: Session, *, user_id: int):
        PowerUpService._ensure_catalog_seeded(db)
        catalog_rows = db.query(PowerUpCatalog).all()
        raw_inventory = db.query(UserPowerUpInventory).filter(
            UserPowerUpInventory.user_id == user_id
        ).all()
        inventory_map = {
            row.powerup_type: int(row.quantity or 0)
            for row in raw_inventory
        }

        result = []
        for catalog in catalog_rows:
            result.append(
                {
                    "powerup_type": catalog.powerup_type.value,
                    "quantity": inventory_map.get(catalog.powerup_type, 0),
                    "base_cost_coins": int(catalog.base_cost_coins),
                    "is_enabled": bool(catalog.is_enabled),
                }
            )
        return result

    @staticmethod
    def purchase_powerup(
        db: Session,
        *,
        user_id: int,
        powerup_type: PowerUpType,
        quantity: int = 1,
    ) -> Dict[str, Any]:
        if quantity <= 0:
            raise ValueError("quantity must be greater than zero")

        PowerUpService._ensure_catalog_seeded(db)
        catalog_entry = db.query(PowerUpCatalog).filter(
            PowerUpCatalog.powerup_type == powerup_type,
            PowerUpCatalog.is_enabled.is_(True),
        ).first()
        if not catalog_entry:
            raise ValueError(f"Power-up type {powerup_type.value} is not available")

        base_cost = int(catalog_entry.base_cost_coins)
        total_cost = base_cost * quantity
        purchase_ref = f"powerup_purchase:{user_id}:{powerup_type.value}:{datetime.now(timezone.utc).isoformat()}"

        debit_result = CoinService.debit_coins(
            db,
            user_id=user_id,
            amount_coins=total_cost,
            transaction_type=CoinTransactionType.DEBIT_POWERUP,
            external_ref=purchase_ref,
            details={
                "powerup_type": powerup_type.value,
                "quantity": quantity,
                "base_cost_coins": base_cost,
                "charged_cost_coins": total_cost,
                "kind": "inventory_purchase",
            },
        )

        inventory = PowerUpService._get_or_create_inventory_row(
            db,
            user_id=user_id,
            powerup_type=powerup_type,
        )
        inventory.quantity = int(inventory.quantity or 0) + quantity
        db.commit()

        return {
            "powerup_type": powerup_type.value,
            "purchased_quantity": quantity,
            "inventory_after": inventory.quantity,
            "base_cost_coins": base_cost,
            "charged_cost_coins": total_cost,
            "balance_after": debit_result["balance_after"],
        }

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
    def _find_existing_effect(
        db: Session,
        *,
        target_user_id: int,
        source_group_id: int,
        effective_utc_date: date,
        powerup_type: PowerUpType,
        fixture_id: Optional[int],
    ) -> Optional[PowerUpDailyEffect]:
        return db.query(PowerUpDailyEffect).filter(
            PowerUpDailyEffect.user_id == target_user_id,
            PowerUpDailyEffect.source_group_id == source_group_id,
            PowerUpDailyEffect.effective_utc_date == effective_utc_date,
            PowerUpDailyEffect.powerup_type == powerup_type,
            PowerUpDailyEffect.fixture_id == (fixture_id if powerup_type == PowerUpType.MULTIPLIER else None),
        ).first()

    @staticmethod
    def _required_inventory_units(
        *,
        powerup_type: PowerUpType,
        target_in_source_group: bool,
    ) -> int:
        # Policy: freeze targeted outside source group costs 2x inventory.
        if powerup_type == PowerUpType.FREEZE and not target_in_source_group:
            return 2
        return 1

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
        existing_effect = PowerUpService._find_existing_effect(
            db,
            target_user_id=target_user_id,
            source_group_id=source_group_id,
            effective_utc_date=effective_utc_date,
            powerup_type=powerup_type,
            fixture_id=fixture_id,
        )
        duplicate_effect = existing_effect is not None

        required_units = PowerUpService._required_inventory_units(
            powerup_type=powerup_type,
            target_in_source_group=target_in_source_group,
        )
        inventory = PowerUpService._get_or_create_inventory_row(
            db,
            user_id=purchaser_user_id,
            powerup_type=powerup_type,
        )
        if int(inventory.quantity or 0) < required_units:
            raise ValueError(
                f"Insufficient inventory: {required_units} {powerup_type.value} required for this activation"
            )
        # Option A: inventory is still consumed even if effect is duplicate.
        inventory.quantity = int(inventory.quantity) - required_units

        cost_multiplier = required_units
        base_cost = int(catalog_entry.base_cost_coins)
        charged_cost = base_cost * required_units

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
            ledger_entry_id=None,
            details={
                "target_in_source_group": target_in_source_group,
                "inventory_based": True,
            },
        )
        db.add(activation)
        db.flush()

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
            "inventory_consumed": required_units,
            "inventory_after": inventory.quantity,
            "effect_applied": effect_applied,
            "duplicate_effect": duplicate_effect,
        }
