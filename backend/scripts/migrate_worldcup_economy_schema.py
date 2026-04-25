#!/usr/bin/env python3
"""
World Cup economy schema migration utility.

Creates or rolls back Day 2 schema tables for:
- wallets/coin ledger
- power-up catalog/activations/effects
- canonical global competition lock/entry
"""

import argparse
import logging
import os
import sys
from typing import Dict, List

from sqlalchemy import inspect

# Add backend root to Python path when script is run from repo root.
CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db.database import engine  # noqa: E402
from app.db.models import (  # noqa: E402
    UserWallet,
    CoinLedgerEntry,
    PowerUpCatalog,
    PowerUpActivation,
    PowerUpDailyEffect,
    GlobalCompetitionWindow,
    GlobalCanonicalEntry,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


TABLES_IN_CREATE_ORDER = [
    UserWallet.__table__,
    CoinLedgerEntry.__table__,
    PowerUpCatalog.__table__,
    PowerUpActivation.__table__,
    PowerUpDailyEffect.__table__,
    GlobalCompetitionWindow.__table__,
    GlobalCanonicalEntry.__table__,
]

TABLES_IN_DROP_ORDER = list(reversed(TABLES_IN_CREATE_ORDER))


def verify_tables() -> Dict[str, bool]:
    """Return table-existence status for world cup economy tables."""
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    checks = {}
    for table in TABLES_IN_CREATE_ORDER:
        checks[table.name] = table.name in existing
    return checks


def print_verification(checks: Dict[str, bool]) -> None:
    for table_name, exists in checks.items():
        marker = "OK" if exists else "MISSING"
        logger.info("%s %s", marker, table_name)


def migrate() -> None:
    logger.info("Starting World Cup economy schema migration...")
    for table in TABLES_IN_CREATE_ORDER:
        logger.info("Ensuring table exists: %s", table.name)
        table.create(bind=engine, checkfirst=True)

    checks = verify_tables()
    print_verification(checks)
    missing = [name for name, exists in checks.items() if not exists]
    if missing:
        raise RuntimeError(f"Migration incomplete, missing tables: {missing}")

    logger.info("World Cup economy schema migration completed successfully.")


def rollback() -> None:
    logger.warning("Starting rollback for World Cup economy schema...")
    for table in TABLES_IN_DROP_ORDER:
        logger.warning("Dropping table if exists: %s", table.name)
        table.drop(bind=engine, checkfirst=True)

    checks = verify_tables()
    print_verification(checks)
    remaining = [name for name, exists in checks.items() if exists]
    if remaining:
        raise RuntimeError(f"Rollback incomplete, tables still present: {remaining}")

    logger.warning("World Cup economy schema rollback completed.")


def run_verify_only() -> None:
    logger.info("Verifying World Cup economy schema tables...")
    checks = verify_tables()
    print_verification(checks)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate or rollback World Cup economy schema."
    )
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Drop World Cup economy schema tables in reverse dependency order.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify table existence; do not apply changes.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if args.verify_only:
            run_verify_only()
        elif args.rollback:
            rollback()
        else:
            migrate()
        return 0
    except Exception as exc:
        logger.error("Schema operation failed: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
