"""
World Cup 2026 hybrid schedule: calendar tournament start + explicit rivalry days.

Other leagues keep week-based activation; World Cup uses UTC calendar dates here.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import List, Optional, Set

from sqlalchemy.orm import Session

WORLD_CUP_TOURNAMENT_START = date(2026, 6, 11)  # MD1 window begins (per product schedule)
WORLD_CUP_TOURNAMENT_END = date(2026, 7, 19)

# Rivalry feature days (UTC calendar date). Includes Jul 15 (semis) per product.
WORLD_CUP_RIVALRY_DATES: Set[date] = {
    date(2026, 6, 14),
    date(2026, 6, 17),
    date(2026, 6, 20),
    date(2026, 6, 23),
    date(2026, 6, 27),
    date(2026, 6, 30),
    date(2026, 7, 3),
    date(2026, 7, 7),
    date(2026, 7, 11),
    date(2026, 7, 15),
    date(2026, 7, 19),
}

_SORTED_RIVALRY: List[date] = sorted(WORLD_CUP_RIVALRY_DATES)


def wc_utc_today(now_utc: Optional[datetime] = None) -> date:
    dt = now_utc or datetime.now(timezone.utc)
    return dt.date()


def is_world_cup_tournament_started(today: date) -> bool:
    return today >= WORLD_CUP_TOURNAMENT_START


def is_world_cup_rivalry_calendar_day(today: date) -> bool:
    return today in WORLD_CUP_RIVALRY_DATES


def next_world_cup_rivalry_date_strictly_after(d: date) -> Optional[date]:
    for rd in _SORTED_RIVALRY:
        if rd > d:
            return rd
    return None


def next_world_cup_rivalry_date_on_or_after(d: date) -> Optional[date]:
    for rd in _SORTED_RIVALRY:
        if rd >= d:
            return rd
    return None


def world_cup_weeks_until_activation(today: date) -> int:
    """Whole weeks until tournament start (0 once started)."""
    if today >= WORLD_CUP_TOURNAMENT_START:
        return 0
    delta = (WORLD_CUP_TOURNAMENT_START - today).days
    return max(0, (delta + 6) // 7)


def world_cup_activation_progress(today: date) -> float:
    """0–100 progress bar toward tournament start (calendar-based)."""
    if today >= WORLD_CUP_TOURNAMENT_START:
        return 100.0
    anchor_start = date(WORLD_CUP_TOURNAMENT_START.year, 1, 1)
    total_days = max(1, (WORLD_CUP_TOURNAMENT_START - anchor_start).days)
    done = max(0, (today - anchor_start).days)
    return float(min(100, max(0, (done / total_days) * 100)))


def canonical_matchweek_on_utc_date(
    db: Session,
    *,
    league: str,
    season: str,
    on_date: date,
) -> int:
    """Matchweek index from fixtures as of noon UTC on ``on_date`` (avoids boundary issues)."""
    from ..db.repository import calculate_canonical_matchweek

    noon = datetime.combine(on_date, time(12, 0, 0), tzinfo=timezone.utc)
    return int(calculate_canonical_matchweek(db=db, league=league, season=season, now_utc=noon))


def world_cup_weeks_until_next_rivalry(today: date) -> int:
    """0 on a rivalry day; otherwise whole weeks until the next rivalry date."""
    if today in WORLD_CUP_RIVALRY_DATES:
        return 0
    nxt = next_world_cup_rivalry_date_on_or_after(today)
    if not nxt:
        return 0
    delta = (nxt - today).days
    return max(0, (delta + 6) // 7)


def world_cup_display_activation_week() -> int:
    """Stable display value for 'unlock at week X' in UI (tournament week 1 = opening)."""
    return 1
