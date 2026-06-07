"""Daily seed derivation per §22. Same spins for everyone each day. The
seed is purely a function of (server_key, date, competition) so anyone can
replay it deterministically, but no one can predict tomorrow's puzzle."""

from __future__ import annotations

import datetime as _dt
import hashlib
import hmac

from .protocol import SERVER_KEY


def today_utc() -> str:
    return _dt.datetime.now(tz=_dt.timezone.utc).strftime("%Y-%m-%d")


def daily_nonce_prefix(competition: str, day: str | None = None) -> str:
    """Deterministic prefix used to identify which day's puzzle a nonce
    belongs to. The per-user random suffix is appended downstream so each
    user can submit their own row (the prefix is the same for everyone)."""
    day = day or today_utc()
    return f"daily:{competition}:{day}"


def daily_nonce(competition: str, day: str | None = None, user_random: str | None = None) -> str:
    """Per-user daily nonce. The prefix lets the server identify the daily
    seed; the random suffix (if provided) makes the nonce unique per
    submission so multiple users can submit on the same daily puzzle."""
    prefix = daily_nonce_prefix(competition, day)
    if user_random:
        return f"{prefix}:{user_random}"
    return prefix


def parse_daily_nonce(nonce: str) -> tuple[str, str] | None:
    """Returns (competition, day) if the nonce is a daily nonce; None otherwise."""
    parts = nonce.split(":")
    if len(parts) < 3 or parts[0] != "daily":
        return None
    return parts[1], parts[2]


def daily_seed(competition: str, day: str | None = None) -> int:
    """HMAC-derived seed (32 bits). Stable for a given competition + day."""
    day = day or today_utc()
    msg = f"{competition}|{day}".encode("utf-8")
    digest = hmac.new(SERVER_KEY, msg, hashlib.sha256).digest()
    return int.from_bytes(digest[:4], "big")
