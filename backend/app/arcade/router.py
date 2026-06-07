"""FastAPI router. Endpoints:
  GET  /api/arcade/competitions
  GET  /api/arcade/daily?competition=epl
  POST /api/arcade/submit       — verify a finished run, write to leaderboard
  GET  /api/arcade/leaderboard  — top N + around-me, 30s edge-cacheable

Per §10 we keep the threat model proportionate: HMAC signature on server-
issued nonces, server-side replay of every submission, per-IP daily-mode cap,
username sanitation. No accounts, no captchas."""

from __future__ import annotations

import secrets
import time
from collections import defaultdict
from threading import Lock
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ...engine_py import SIM_VERSION
from .daily import daily_nonce, daily_nonce_prefix, daily_seed, parse_daily_nonce, today_utc
from .loader import get_config, get_pool, list_live_slugs
from .protocol import derive_seed, fresh_nonce
from .replay import replay
from .storage import STORE, SubmittedRun, sanitize_username


router = APIRouter(prefix="/api/arcade")


# --- per-IP daily-mode cap (§10) ---
_daily_cap_lock = Lock()
_daily_cap: dict[tuple[str, str, str], set[str]] = defaultdict(set)
# key: (ip, competition, day) → set of nonces submitted


def _client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    if req.client:
        return req.client.host
    return "unknown"


@router.get("/competitions")
def list_competitions() -> dict[str, Any]:
    return {"live": list_live_slugs(), "sim_version": SIM_VERSION}


@router.get("/daily")
def daily(competition: str) -> dict[str, Any]:
    """Returns a per-user daily nonce + the deterministic daily seed. The
    seed is the same for every user on a given day (fair puzzle); the nonce
    carries a per-user random suffix so each user can submit their own row
    on the daily leaderboard."""
    if not get_config(competition):
        raise HTTPException(status_code=404, detail="unknown competition")
    day = today_utc()
    user_random = secrets.token_hex(6)
    return {
        "competition": competition,
        "day": day,
        "nonce": daily_nonce(competition, day, user_random=user_random),
        "seed": daily_seed(competition, day),
    }


@router.get("/nonce")
def issue_nonce(competition: str, mode: str) -> dict[str, Any]:
    """For non-daily modes: a server-issued nonce so the client's seed is
    derived via HMAC and cannot be peeked at locally. For daily mode: each
    user gets a unique nonce sharing a deterministic day prefix."""
    if not get_config(competition):
        raise HTTPException(status_code=404, detail="unknown competition")
    if mode == "daily":
        day = today_utc()
        user_random = secrets.token_hex(6)
        nonce = daily_nonce(competition, day, user_random=user_random)
        return {"nonce": nonce, "seed": daily_seed(competition, day)}
    nonce = fresh_nonce()
    return {"nonce": nonce, "seed": derive_seed(nonce)}


class Pick(BaseModel):
    playerId: str
    slotKey: str


class SubmitBody(BaseModel):
    competition: str
    mode: str = Field(pattern=r"^(classic|expert|hard|daily)$")
    nonce: str
    formationId: str | None = None
    picks: list[Pick]
    username: str
    day: str | None = None  # required for daily mode


@router.post("/submit")
def submit(body: SubmitBody, req: Request) -> dict[str, Any]:
    config = get_config(body.competition)
    pool = get_pool(body.competition)
    if not config or not pool:
        raise HTTPException(status_code=404, detail="unknown competition")

    try:
        username = sanitize_username(body.username)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Daily-mode integrity: nonce carries (competition, day) and the per-user
    # random suffix. We trust the day from the nonce so a player who started
    # before midnight UTC and finished after still gets a clean submission.
    # The sim seed is derived from the day, NOT the random suffix, so every
    # user playing today plays the same puzzle.
    sim_seed_override: int | None = None
    nonce_day: str | None = None
    if body.mode == "daily":
        parsed = parse_daily_nonce(body.nonce)
        if not parsed:
            raise HTTPException(status_code=400, detail="invalid daily nonce")
        nonce_competition, nonce_day = parsed
        if nonce_competition != body.competition:
            raise HTTPException(status_code=400, detail="daily nonce: competition mismatch")
        ip = _client_ip(req)
        cap_key = (ip, body.competition, nonce_day)
        with _daily_cap_lock:
            if _daily_cap.get(cap_key):
                raise HTTPException(status_code=429, detail="one daily submission per IP per competition")
        sim_seed_override = daily_seed(body.competition, nonce_day)

    # Replay the run server-side.
    try:
        replayed = replay(
            config=config,
            pool=pool,
            nonce=body.nonce,
            formation_id=body.formationId,
            picks=[p.model_dump() for p in body.picks],
            seed_override=sim_seed_override,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = replayed["result"]
    wins = result["wins"]
    losses = result["losses"]
    score = wins * 1000 - losses
    run = SubmittedRun(
        nonce=body.nonce,
        competition=body.competition,
        mode=body.mode,
        sim_version=SIM_VERSION,
        pool_version=pool.get("poolVersion", 1),
        username=username,
        score=score,
        record=result["record"],
        team_rating=replayed["rating"],
        team=[p.model_dump() for p in body.picks],
        day=nonce_day if body.mode == "daily" else None,
        created_at=time.time(),
    )
    ok = STORE.insert(run)
    if not ok:
        # The nonce uniqueness constraint per §6.3 enforces single-submit-per-run.
        raise HTTPException(status_code=409, detail="this run has already been submitted")

    if body.mode == "daily" and nonce_day:
        ip = _client_ip(req)
        cap_key = (ip, body.competition, nonce_day)
        with _daily_cap_lock:
            _daily_cap[cap_key].add(body.nonce)

    # Surface the rank for the response screen.
    full = STORE.leaderboard(body.competition, body.mode, SIM_VERSION, run.day, limit=10_000_000)
    rank = next((r["rank"] for r in full if r["nonce"] == body.nonce), None)
    around = STORE.around_me(body.competition, body.mode, SIM_VERSION, body.nonce, day=run.day)
    return {
        "rank": rank,
        "total": len(full),
        "score": score,
        "record": result["record"],
        "rating": replayed["rating"],
        "tier": result.get("tier"),
        "around": around,
    }


@router.get("/leaderboard")
def leaderboard(
    competition: str,
    mode: str = Query(pattern=r"^(classic|expert|hard|daily)$"),
    day: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    if not get_config(competition):
        raise HTTPException(status_code=404, detail="unknown competition")
    rows = STORE.leaderboard(competition, mode, SIM_VERSION, day, limit)
    return {
        "competition": competition,
        "mode": mode,
        "sim_version": SIM_VERSION,
        "day": day,
        "rows": rows,
        "total": len(rows),
    }
