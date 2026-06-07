#!/usr/bin/env python3
"""
calibrate.py — Monte-Carlo §5.2 invariant check.

Verifies that a competition's (config, pool) pair satisfies the calibration
invariant from draft-dogs-arcade-plan.md §5.2:

  Perfect draft (R≈99 across the XI): perfect record in ~30–50% of sims.
  Greedy-realistic draft (real spin RNG, best-fit unused player per cell):
  perfect record in ~2–5% of sims.

This is a standalone Python re-implementation of the sim formulas — it does
NOT import the TS engine. For exact cross-engine equivalence, see the
Python engine mirror (task #20). The point of this script is to catch a
pool edit that silently makes the target trivial (or impossible).

Usage:
  python scripts/calibrate.py data/configs/worldcup.json data/pools/worldcup.json
  python scripts/calibrate.py data/configs/worldcup.json data/pools/worldcup.json --n 50000 --strict
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import Counter
from pathlib import Path
from typing import Any


BALANCE_LAMBDA = 0.35


def fit(player_positions: list[str], slot: dict[str, Any]) -> float:
    """Positional fit per §4.1. Mirrors engine/fit.ts."""
    group = slot.get("group")
    if group == "GK":
        return 1.0 if "GK" in player_positions else 0.4
    if "GK" in player_positions:
        return 0.4
    eligible = slot.get("eligible", []) or []
    if any(pos in player_positions for pos in eligible):
        return 1.0
    adjacent = slot.get("adjacent", []) or []
    if any(pos in player_positions for pos in adjacent):
        return 0.85
    if group == "FREE":
        return 1.0
    return 0.55


def rate_team(picks: list[dict[str, Any] | None], slots: list[dict[str, Any]]) -> float:
    """Team rating per §5.1. Mirrors engine/rating.ts."""
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
    weight_sum = sum(w for w, _ in slot_scores)
    weighted = sum(w * s for w, s in slot_scores)
    base = weighted / weight_sum if weight_sum > 0 else 0.0
    min_score = min(s for _, s in slot_scores)
    balance_pen = BALANCE_LAMBDA * max(0.0, base - min_score)
    return max(50.0, min(99.0, base - balance_pen))


def sigmoid(x: float) -> float:
    if x > 50:
        return 1.0
    if x < -50:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


GROUP_QUALIFICATION_PTS = 4


def simulate_tournament(R: float, config: dict[str, Any], rng: random.Random) -> tuple[int, int, int, bool]:
    """Tournament sim per §5.3. Returns (W, D, L, perfect)."""
    wins = draws = losses = 0
    eliminated = False
    stages = config["stages"]
    k = config["sim"]["k"]
    draw_peak_cfg = config["sim"].get("drawPeak", 0.22)
    stage_opps = config["sim"].get("opp", {}).get("stages", {})
    last_group_index = -1
    for i, st in enumerate(stages):
        if st in ("group", "league"):
            last_group_index = i
    group_pts = 0
    for i, stage in enumerate(stages):
        if eliminated:
            break
        dist = stage_opps.get(stage, {"mean": 80 + i * 1.5, "std": 5})
        opp = rng.gauss(dist["mean"], dist["std"])
        p_win = max(0.001, min(0.999, sigmoid(k * (R - opp))))
        is_group = stage in ("group", "league")
        draw_peak = draw_peak_cfg if is_group else 0.0
        closeness = max(0.0, 1.0 - 4.0 * (p_win - 0.5) ** 2)
        draw_prob = draw_peak * closeness
        r = rng.random()
        if r < (1 - draw_prob) * p_win:
            outcome = "W"
            wins += 1
        elif r < (1 - draw_prob) * p_win + draw_prob:
            outcome = "D"
            draws += 1
        else:
            outcome = "L"
            losses += 1
        if is_group:
            group_pts += 3 if outcome == "W" else 1 if outcome == "D" else 0
            if i == last_group_index and group_pts < GROUP_QUALIFICATION_PTS:
                eliminated = True
        elif outcome != "W":
            eliminated = True
    target = config["target"]["games"]
    perfect = wins == target and losses == 0 and draws == 0
    return wins, draws, losses, perfect


def simulate_season(R: float, config: dict[str, Any], rng: random.Random) -> tuple[int, int, int, bool]:
    """Season sim per §5.2. Includes optional playoff epilogue (NFL)."""
    games = config["target"]["games"]
    opp_dist = config["sim"].get("opp", {}).get("season", {"mean": 78, "std": 7})
    opp_mean = opp_dist["mean"]
    opp_std = opp_dist["std"]
    draw_peak = config["sim"].get("drawPeak", 0.0)
    k = config["sim"]["k"]
    is_soccer = config["sport"] == "soccer"
    wins = draws = losses = 0
    for _ in range(games):
        opp = rng.gauss(opp_mean, opp_std)
        p_win = max(0.001, min(0.999, sigmoid(k * (R - opp))))
        if is_soccer:
            closeness = max(0.0, 1.0 - 4.0 * (p_win - 0.5) ** 2)
            draw_prob = draw_peak * closeness
            r = rng.random()
            if r < (1 - draw_prob) * p_win:
                wins += 1
            elif r < (1 - draw_prob) * p_win + draw_prob:
                draws += 1
            else:
                losses += 1
        else:
            if rng.random() < p_win:
                wins += 1
            else:
                losses += 1
    # Playoff epilogue: threshold-based.
    playoff_stages = config["sim"].get("playoffStages") or []
    playoff_threshold = config["sim"].get("playoffThreshold", games)
    if playoff_stages and wins >= playoff_threshold:
        eliminated = False
        for ps in playoff_stages:
            if eliminated:
                break
            opp = rng.gauss(ps["opp"]["mean"], ps["opp"]["std"])
            p_win = max(0.001, min(0.999, sigmoid(k * (R - opp))))
            if rng.random() < p_win:
                wins += 1
            else:
                losses += 1
                eliminated = True
    total_target = games + len(playoff_stages)
    perfect = wins == total_target and losses == 0 and (not is_soccer or draws == 0)
    return wins, draws, losses, perfect


def greedy_realistic_draft(
    config: dict[str, Any],
    pool: dict[str, Any],
    formation: dict[str, Any],
    rng: random.Random,
) -> list[dict[str, Any] | None]:
    """Simulate a play-through where the user picks the highest-fit×OVR
    available player into the best slot, given the actual spin RNG. This is
    optimistic — it represents the upper bound of skilled play subject to
    spin luck."""
    spin_table = config["spinTable"]
    slots = formation["slots"]
    picks: list[dict[str, Any] | None] = [None] * len(slots)
    used_ids: set[str] = set()
    used_names: set[str] = set()
    drawn_eras: list[str] = []
    era_repeat = config.get("eraRepeat", True)

    for _ in range(config["rounds"]):
        allowed = spin_table if era_repeat else [c for c in spin_table if c["era"] not in drawn_eras]
        if not allowed:
            break
        cell = rng.choice(allowed)
        cands = [
            p for p in pool["players"]
            if p["entity"] == cell["entity"] and p["era"] == cell["era"]
            and p["id"] not in used_ids
            and p["name"].lower().strip() not in used_names
        ]
        if not cands:
            if not era_repeat:
                drawn_eras.append(cell["era"])
            continue
        best: tuple[float, int, dict[str, Any]] | None = None
        for slot_idx, slot in enumerate(slots):
            if picks[slot_idx] is not None:
                continue
            for cand in cands:
                score = cand["ovr"] * fit(cand["positions"], slot)
                if best is None or score > best[0]:
                    best = (score, slot_idx, cand)
        if best is None:
            break
        _, slot_idx, cand = best
        picks[slot_idx] = cand
        used_ids.add(cand["id"])
        used_names.add(cand["name"].lower().strip())
        if not era_repeat:
            drawn_eras.append(cell["era"])
    return picks


def resolve_formation(config: dict[str, Any]) -> dict[str, Any]:
    roster = config["roster"]
    if roster["type"] == "formation":
        return roster["formations"][0]
    if roster["type"] == "typed":
        return {"slots": roster["slots"]}
    n = roster.get("count", config["rounds"])
    return {
        "slots": [
            {"key": f"S{i+1}", "eligible": [], "weight": 1.0, "group": "FREE"}
            for i in range(n)
        ]
    }


def record_key(w: int, d: int, l: int, is_soccer: bool) -> str:
    return f"{w}-{d}-{l}" if is_soccer else f"{w}-{l}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Monte-Carlo §5.2 invariant check.")
    parser.add_argument("config", help="data/configs/{slug}.json")
    parser.add_argument("pool", help="data/pools/{slug}.json")
    parser.add_argument("--n", type=int, default=10000, help="Simulations per scenario (default 10k)")
    parser.add_argument("--seed", type=int, default=12345)
    parser.add_argument("--perfect-min", type=float, default=0.30)
    parser.add_argument("--perfect-max", type=float, default=0.50)
    parser.add_argument("--greedy-min", type=float, default=0.02)
    parser.add_argument("--greedy-max", type=float, default=0.05)
    parser.add_argument("--strict", action="store_true", help="Exit 1 if invariants violated (for CI)")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    pool = json.loads(Path(args.pool).read_text(encoding="utf-8"))
    is_soccer = config["sport"] == "soccer"
    run_mode = config["runMode"]
    simulate = simulate_tournament if run_mode == "tournament" else simulate_season

    # 1) Perfect draft: R = 99 (no balance penalty since min slot score == base).
    rng = random.Random(args.seed)
    perfect_hits = 0
    perfect_records: Counter[str] = Counter()
    for _ in range(args.n):
        w, d, l, perfect = simulate(99.0, config, rng)
        if perfect:
            perfect_hits += 1
        perfect_records[record_key(w, d, l, is_soccer)] += 1
    perfect_rate = perfect_hits / args.n

    # 2) Greedy realistic: actual spin RNG drives cell selection.
    formation = resolve_formation(config)
    rng2 = random.Random(args.seed + 1)
    greedy_hits = 0
    greedy_records: Counter[str] = Counter()
    rating_sum = 0.0
    for _ in range(args.n):
        picks = greedy_realistic_draft(config, pool, formation, rng2)
        R = rate_team(picks, formation["slots"])
        rating_sum += R
        w, d, l, perfect = simulate(R, config, rng2)
        if perfect:
            greedy_hits += 1
        greedy_records[record_key(w, d, l, is_soccer)] += 1
    greedy_rate = greedy_hits / args.n
    avg_R = rating_sum / args.n

    target = config["target"]["label"]
    print(f"Competition: {config['slug']}  run_mode={run_mode}  target={target}")
    print(f"N per scenario: {args.n}")
    print()
    print("=== PERFECT XI (R=99, fit=1.0 across slots) ===")
    print(f"  perfect-record rate: {perfect_rate*100:6.2f}%  "
          f"(target {args.perfect_min*100:.0f}-{args.perfect_max*100:.0f}%)")
    for k, c in perfect_records.most_common(5):
        print(f"    {k:>10}  {c/args.n*100:5.2f}%  ({c})")
    print()
    print(f"=== GREEDY REALISTIC (best-fit pick per spin, avg R={avg_R:.1f}) ===")
    print(f"  perfect-record rate: {greedy_rate*100:6.2f}%  "
          f"(target {args.greedy_min*100:.0f}-{args.greedy_max*100:.0f}%)")
    for k, c in greedy_records.most_common(8):
        print(f"    {k:>10}  {c/args.n*100:5.2f}%  ({c})")

    perfect_ok = args.perfect_min <= perfect_rate <= args.perfect_max
    greedy_ok = args.greedy_min <= greedy_rate <= args.greedy_max
    print()
    print(f"Invariants: perfect {'PASS' if perfect_ok else 'FAIL'} | "
          f"greedy {'PASS' if greedy_ok else 'FAIL'}")

    if args.strict and not (perfect_ok and greedy_ok):
        sys.exit(1)


if __name__ == "__main__":
    main()
