"""Team rating + balance penalty per §5.1. Mirrors engine/rating.ts."""

from __future__ import annotations
from typing import Any

from .fit import fit

BALANCE_LAMBDA = 0.35


def rate_team(picks: list[dict[str, Any] | None], slots: list[dict[str, Any]]) -> float:
    slot_scores: list[tuple[float, float]] = []
    for pick, slot in zip(picks, slots):
        w = slot.get("weight", 1.0)
        if pick is None:
            slot_scores.append((w, 0.0))
            continue
        f = fit(pick["positions"], slot)
        slot_scores.append((w, pick["ovr"] * f))
    if not slot_scores:
        return 50.0
    weight_sum = sum(w for w, _ in slot_scores) or 1.0
    weighted = sum(w * s for w, s in slot_scores)
    base = weighted / weight_sum
    min_score = min(s for _, s in slot_scores)
    pen = BALANCE_LAMBDA * max(0.0, base - min_score)
    return max(50.0, min(99.0, base - pen))
