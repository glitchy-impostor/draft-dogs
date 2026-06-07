"""Season + tournament simulators per §5.2/§5.3. Mirrors engine/sim/."""

from __future__ import annotations

import math
from typing import Any

from .prng import PRNG, mix32


def _sigmoid(x: float) -> float:
    if x > 50:
        return 1.0
    if x < -50:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def _clamp_prob(p: float) -> float:
    if not math.isfinite(p):
        return 0.5
    return max(0.001, min(0.999, p))


def _scoreline_lambdas_tournament(R: float, opp: float) -> tuple[float, float]:
    us = max(0.25, 1.2 + (R - 75) * 0.045 - (opp - 75) * 0.022)
    them = max(0.25, 1.2 + (opp - 75) * 0.045 - (R - 75) * 0.022)
    return us, them


def _scoreline_lambdas_season(R: float, opp: float) -> tuple[float, float]:
    us = max(0.3, 1.4 + (R - 75) * 0.04 - (opp - 75) * 0.02)
    them = max(0.3, 1.4 + (opp - 75) * 0.04 - (R - 75) * 0.02)
    return us, them


def _sample_poisson(prng: PRNG, lam: float) -> int:
    if lam <= 0:
        return 0
    k = 0
    p = math.exp(-lam)
    cum = p
    r = prng.next_float()
    while r > cum and k < 8:
        k += 1
        p *= lam / k
        cum += p
    return k


def _make_scoreline(prng: PRNG, R: float, opp: float, outcome: str, season: bool) -> str:
    lu, lt = _scoreline_lambdas_season(R, opp) if season else _scoreline_lambdas_tournament(R, opp)
    us = _sample_poisson(prng, lu)
    them = _sample_poisson(prng, lt)
    if outcome == "W" and us <= them:
        us = them + 1
    elif outcome == "L" and us >= them:
        them = us + 1
    elif outcome == "D":
        them = us
    return f"{us}-{them}"


GROUP_QUALIFICATION_PTS = 4


def simulate_tournament(R: float, config: dict[str, Any], seed: int) -> dict[str, Any]:
    prng = PRNG(seed & 0xFFFFFFFF)
    matches: list[dict[str, Any]] = []
    wins = draws = losses = 0
    stage_reached = ""
    eliminated = False
    k = config["sim"]["k"]
    draw_peak_cfg = config["sim"].get("drawPeak", 0.22)
    stage_opps = config["sim"].get("opp", {}).get("stages", {})
    is_soccer = config["sport"] == "soccer"

    last_group_index = -1
    for i, st in enumerate(config["stages"]):
        if st in ("group", "league"):
            last_group_index = i
    group_pts = 0

    for i, stage in enumerate(config["stages"]):
        if eliminated:
            break
        dist = stage_opps.get(stage, {"mean": 80 + i * 1.5, "std": 5})
        opp = prng.next_normal(dist["mean"], dist["std"])
        p_win = _clamp_prob(_sigmoid(k * (R - opp)))
        is_group = stage in ("group", "league")
        draw_peak = draw_peak_cfg if is_group else 0.0
        closeness = max(0.0, 1.0 - 4.0 * (p_win - 0.5) ** 2)
        draw_prob = draw_peak * closeness
        r = prng.next_float()
        if r < (1 - draw_prob) * p_win:
            outcome = "W"
            wins += 1
        elif r < (1 - draw_prob) * p_win + draw_prob:
            outcome = "D"
            draws += 1
        else:
            outcome = "L"
            losses += 1
        scoreline = _make_scoreline(prng, R, opp, outcome, season=False) if is_soccer else None
        matches.append({
            "index": i, "stage": stage, "oppRating": opp,
            "pWin": p_win, "outcome": outcome, "scoreLine": scoreline,
        })
        stage_reached = stage
        if is_group:
            group_pts += 3 if outcome == "W" else 1 if outcome == "D" else 0
            if i == last_group_index and group_pts < GROUP_QUALIFICATION_PTS:
                eliminated = True
        elif outcome != "W":
            eliminated = True

    target = config["target"]["games"]
    perfect = wins == target and losses == 0 and draws == 0
    record = f"{wins}-{draws}-{losses}" if is_soccer else f"{wins}-{losses}"
    return {
        "mode": "tournament",
        "wins": wins, "draws": draws, "losses": losses, "record": record,
        "matches": matches, "stageReached": stage_reached, "perfectRun": perfect,
    }


def simulate_season(R: float, config: dict[str, Any], seed: int) -> dict[str, Any]:
    prng = PRNG(seed & 0xFFFFFFFF)
    games = config["target"]["games"]
    opp = config["sim"].get("opp", {}).get("season", {"mean": 78, "std": 7})
    opp_mean = opp["mean"]
    opp_std = opp["std"]
    draw_peak = config["sim"].get("drawPeak", 0.0)
    k = config["sim"]["k"]
    is_soccer = config["sport"] == "soccer"
    wins = draws = losses = 0
    matches: list[dict[str, Any]] = []

    for i in range(games):
        opp_R = prng.next_normal(opp_mean, opp_std)
        p_win = _clamp_prob(_sigmoid(k * (R - opp_R)))
        if is_soccer:
            closeness = max(0.0, 1.0 - 4.0 * (p_win - 0.5) ** 2)
            draw_prob = draw_peak * closeness
            r = prng.next_float()
            if r < (1 - draw_prob) * p_win:
                outcome = "W"; wins += 1
            elif r < (1 - draw_prob) * p_win + draw_prob:
                outcome = "D"; draws += 1
            else:
                outcome = "L"; losses += 1
        else:
            outcome = "W" if prng.next_float() < p_win else "L"
            if outcome == "W": wins += 1
            else: losses += 1
        scoreline = _make_scoreline(prng, R, opp_R, outcome, season=True) if is_soccer else None
        matches.append({
            "index": i, "oppRating": opp_R, "pWin": p_win,
            "outcome": outcome, "scoreLine": scoreline,
        })

    # Playoff epilogue: threshold-based, fires for any team that made playoffs.
    playoff_stages = config["sim"].get("playoffStages") or []
    playoff_threshold = config["sim"].get("playoffThreshold", games)
    made_playoffs = False
    playoff_stage_reached = None
    won_championship = False
    if playoff_stages and wins >= playoff_threshold:
        made_playoffs = True
        eliminated = False
        for pi, ps in enumerate(playoff_stages):
            if eliminated:
                break
            stage_id = ps.get("id") or ps["label"].lower().replace(" ", "")
            opp_R = prng.next_normal(ps["opp"]["mean"], ps["opp"]["std"])
            p_win = _clamp_prob(_sigmoid(k * (R - opp_R)))
            outcome = "W" if prng.next_float() < p_win else "L"
            scoreline = _make_scoreline(prng, R, opp_R, outcome, season=True) if is_soccer else None
            matches.append({
                "index": games + pi, "stage": ps["label"], "oppRating": opp_R,
                "pWin": p_win, "outcome": outcome, "scoreLine": scoreline,
            })
            playoff_stage_reached = stage_id
            if outcome == "W":
                wins += 1
                if pi == len(playoff_stages) - 1:
                    won_championship = True
            else:
                losses += 1
                eliminated = True

    total_target = games + len(playoff_stages)
    perfect = wins == total_target and losses == 0 and (not is_soccer or draws == 0)
    record = f"{wins}-{draws}-{losses}" if is_soccer else f"{wins}-{losses}"
    return {
        "mode": "season",
        "wins": wins, "draws": draws, "losses": losses, "record": record,
        "matches": matches, "perfectRun": perfect,
        "madePlayoffs": made_playoffs,
        "playoffStageReached": playoff_stage_reached,
        "wonChampionship": won_championship,
    }


def simulate(picks: list[dict | None], slots: list[dict], config: dict, rng_state: int) -> dict:
    """End-to-end sim used by the FastAPI handler. Picks are objects with
    `playerId`, `slotKey`, plus a `_player` dict (the full pool row) injected
    by the protocol layer."""
    from .rating import rate_team
    rated_picks = [(p.get("_player") if p else None) for p in picks]
    R = rate_team(rated_picks, slots)
    sim_seed = mix32((rng_state ^ 0x5D3C6F1B) & 0xFFFFFFFF)
    result = simulate_tournament(R, config, sim_seed) if config["runMode"] == "tournament" else simulate_season(R, config, sim_seed)
    return {"rating": R, "result": result}
