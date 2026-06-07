"""Positional fit per §4.1. Mirrors engine/fit.ts."""

from __future__ import annotations
from typing import Any


def fit(player_positions: list[str], slot: dict[str, Any]) -> float:
    group = slot.get("group")
    eligible = slot.get("eligible", []) or []
    # Truly positionless slot (NBA — FREE with no eligibility list).
    if group == "FREE" and not eligible:
        return 1.0
    if group == "GK":
        return 1.0 if "GK" in player_positions else 0.4
    if "GK" in player_positions:
        return 0.4
    if any(pos in player_positions for pos in eligible):
        return 1.0
    adjacent = slot.get("adjacent", []) or []
    if any(pos in player_positions for pos in adjacent):
        return 0.85
    return 0.55
