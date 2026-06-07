"""Server-side replay of a finished run. The client sends raw inputs
(competition, mode, nonce, formationId, picks[]). We:
  1. Validate every pick — player exists in the right cell, no dup IDs, no
     dup names across eras, slot exists & not double-filled.
  2. Rate the team using engine_py.rating.
  3. Run the sim with a seed derived from the nonce server-side.
  4. Return the canonical result.

This is the single source of truth for the leaderboard. Whatever the client
claims, we recompute."""

from __future__ import annotations

from typing import Any

from ...engine_py.prng import mix32
from ...engine_py.rating import rate_team
from ...engine_py.sim import simulate_season, simulate_tournament
from .protocol import derive_seed


def _resolve_slots(config: dict[str, Any], formation_id: str | None) -> tuple[list[dict], dict | None]:
    roster = config["roster"]
    if roster["type"] == "formation":
        forms = roster.get("formations", [])
        f = next((x for x in forms if x["id"] == formation_id), forms[0] if forms else None)
        if not f:
            raise ValueError("no formation matched")
        return f["slots"], f
    if roster["type"] == "typed":
        return roster.get("slots", []), None
    count = roster.get("count", config["rounds"])
    slots = [
        {"key": f"S{i+1}", "eligible": [], "weight": 1.0, "group": "FREE"}
        for i in range(count)
    ]
    return slots, None


def _normalize_name(s: str) -> str:
    return s.lower().strip()


def replay(
    config: dict[str, Any],
    pool: dict[str, Any],
    nonce: str,
    formation_id: str | None,
    picks: list[dict[str, str]],
    seed_override: int | None = None,
) -> dict[str, Any]:
    """`picks` is an ordered list of {playerId, slotKey} as the client made
    them. We don't validate the *spin sequence* (that requires replaying the
    RNG step-by-step). For MVP we trust the spin RNG and validate only the
    final XI's integrity. Spin-sequence replay is a follow-up.

    `seed_override` lets daily mode use a deterministic per-day seed instead
    of derive_seed(nonce) — different users have different nonces but share
    the daily seed."""
    slots, formation = _resolve_slots(config, formation_id)
    if len(picks) != config["rounds"]:
        raise ValueError(f"expected {config['rounds']} picks, got {len(picks)}")

    by_id = {p["id"]: p for p in pool["players"]}
    by_slot_key = {s["key"]: s for s in slots}

    used_ids: set[str] = set()
    used_names: set[str] = set()
    used_slots: set[str] = set()
    resolved_picks: list[dict[str, Any] | None] = [None] * len(slots)

    for pick in picks:
        pid = pick.get("playerId")
        slot_key = pick.get("slotKey")
        if pid not in by_id:
            raise ValueError(f"unknown player {pid}")
        if slot_key not in by_slot_key:
            raise ValueError(f"unknown slot {slot_key}")
        if pid in used_ids:
            raise ValueError(f"player {pid} placed twice")
        if slot_key in used_slots:
            raise ValueError(f"slot {slot_key} filled twice")
        player = by_id[pid]
        name_key = _normalize_name(player["name"])
        if name_key in used_names:
            raise ValueError(f"another era of {player['name']} is already on the XI")
        used_ids.add(pid)
        used_names.add(name_key)
        used_slots.add(slot_key)
        slot_index = next(i for i, s in enumerate(slots) if s["key"] == slot_key)
        resolved_picks[slot_index] = player

    R = rate_team(resolved_picks, slots)
    seed = seed_override if seed_override is not None else derive_seed(nonce)
    sim_seed = mix32((seed ^ 0x5D3C6F1B) & 0xFFFFFFFF)
    if config["runMode"] == "tournament":
        result = simulate_tournament(R, config, sim_seed)
    else:
        result = simulate_season(R, config, sim_seed)
    return {"rating": R, "result": result, "formation": formation["id"] if formation else None}
