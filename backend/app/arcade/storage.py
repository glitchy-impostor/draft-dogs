"""Leaderboard store. SQLite-backed when DD_DB_PATH is set, in-memory
otherwise (suitable for the dev loop and CI). The nonce primary key
enforces 'one submit per run'. Public surface matches §6.3."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
from dataclasses import dataclass, asdict
from typing import Any


_USERNAME_OK = re.compile(r"^[A-Za-z0-9_\-\.]{1,20}$")
_PROFANITY = {"nazi", "rape", "kkk"}  # placeholder — pluggable wordlist


def sanitize_username(name: str) -> str:
    if not isinstance(name, str):
        raise ValueError("username must be a string")
    n = name.strip()[:20]
    if not n:
        raise ValueError("username empty")
    if not _USERNAME_OK.match(n):
        raise ValueError("username has invalid characters (allowed: A-Z a-z 0-9 _ - .)")
    if any(bad in n.lower() for bad in _PROFANITY):
        raise ValueError("username rejected")
    return n


@dataclass
class SubmittedRun:
    nonce: str
    competition: str
    mode: str
    sim_version: int
    pool_version: int
    username: str
    score: int            # wins*1000 - losses
    record: str
    team_rating: float
    team: list[dict]      # full picks (playerId + slotKey)
    day: str | None       # for daily mode
    created_at: float     # epoch seconds


_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  nonce         TEXT PRIMARY KEY,
  competition   TEXT NOT NULL,
  mode          TEXT NOT NULL,
  sim_version   INTEGER NOT NULL,
  pool_version  INTEGER NOT NULL,
  username      TEXT NOT NULL,
  score         INTEGER NOT NULL,
  record        TEXT NOT NULL,
  team_rating   REAL NOT NULL,
  team_json     TEXT NOT NULL,
  day           TEXT,
  created_at    REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_board       ON runs (competition, mode, sim_version, day);
CREATE INDEX IF NOT EXISTS idx_runs_board_score ON runs (competition, mode, sim_version, day, score DESC, team_rating ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_runs_day_comp    ON runs (day, competition);
"""


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "nonce":        row["nonce"],
        "competition":  row["competition"],
        "mode":         row["mode"],
        "sim_version":  row["sim_version"],
        "pool_version": row["pool_version"],
        "username":     row["username"],
        "score":        row["score"],
        "record":       row["record"],
        "team_rating":  row["team_rating"],
        "team":         json.loads(row["team_json"]),
        "day":          row["day"],
        "created_at":   row["created_at"],
    }


class LeaderboardStore:
    """SQLite-backed leaderboard. Pass path=":memory:" for an ephemeral store
    (used in dev / tests when DD_DB_PATH is unset). On a file-backed DB we
    enable WAL so concurrent reads don't block submits."""

    def __init__(self, path: str = ":memory:") -> None:
        self._path = path
        self._lock = threading.Lock()
        # Ensure the parent dir exists BEFORE connecting. Without this,
        # sqlite3.connect("/data/leaderboard.db") raises OperationalError on
        # startup if the Railway volume isn't mounted yet (or the path was
        # mistyped), crashing the worker before it can serve /health.
        if path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        # check_same_thread=False lets uvicorn's async event-loop workers all
        # share one connection; the lock above serializes writes.
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        if path != ":memory:":
            self._conn.execute("PRAGMA journal_mode = WAL")
            self._conn.execute("PRAGMA synchronous = NORMAL")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def insert(self, run: SubmittedRun) -> bool:
        with self._lock:
            try:
                self._conn.execute(
                    """INSERT INTO runs
                       (nonce, competition, mode, sim_version, pool_version, username,
                        score, record, team_rating, team_json, day, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        run.nonce, run.competition, run.mode, run.sim_version,
                        run.pool_version, run.username, run.score, run.record,
                        run.team_rating, json.dumps(run.team), run.day, run.created_at,
                    ),
                )
                self._conn.commit()
                return True
            except sqlite3.IntegrityError:
                # Duplicate nonce — replay of a submitted run.
                return False

    def leaderboard(
        self,
        competition: str,
        mode: str,
        sim_version: int,
        day: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        # day IS ? doesn't behave the same across all SQLite versions when
        # bound to None — split the SQL so NULL handling is explicit.
        if day is None:
            sql = (
                "SELECT * FROM runs "
                "WHERE competition = ? AND mode = ? AND sim_version = ? AND day IS NULL "
                "ORDER BY score DESC, team_rating ASC, created_at ASC LIMIT ?"
            )
            params: tuple[Any, ...] = (competition, mode, sim_version, limit)
        else:
            sql = (
                "SELECT * FROM runs "
                "WHERE competition = ? AND mode = ? AND sim_version = ? AND day = ? "
                "ORDER BY score DESC, team_rating ASC, created_at ASC LIMIT ?"
            )
            params = (competition, mode, sim_version, day, limit)
        with self._lock:
            cur = self._conn.execute(sql, params)
            rows = cur.fetchall()
        return [{**_row_to_dict(r), "rank": i + 1} for i, r in enumerate(rows)]

    def around_me(
        self,
        competition: str,
        mode: str,
        sim_version: int,
        nonce: str,
        window: int = 5,
        day: str | None = None,
    ) -> list[dict[str, Any]]:
        # Pull the whole board to locate the nonce's rank, then slice. Linear
        # but acceptable for the leaderboard sizes we target; tighten with a
        # rank window query if this becomes hot.
        full = self.leaderboard(competition, mode, sim_version, day, limit=10_000_000)
        for i, row in enumerate(full):
            if row["nonce"] == nonce:
                lo = max(0, i - window)
                hi = min(len(full), i + window + 1)
                return full[lo:hi]
        return []

    def clear(self) -> None:
        """Test hook — wipe every row. Don't call in production."""
        with self._lock:
            self._conn.execute("DELETE FROM runs")
            self._conn.commit()

    def count_today(self, ip: str, competition: str, day: str) -> int:
        """Per-day submission count for a competition. (IP is unused at the
        store layer — the router enforces per-IP caps via its own map.)"""
        with self._lock:
            cur = self._conn.execute(
                "SELECT COUNT(*) FROM runs WHERE day = ? AND competition = ?",
                (day, competition),
            )
            return int(cur.fetchone()[0])


# `DD_DB_PATH` (e.g. /data/leaderboard.db when mounted as a Railway volume)
# is the production toggle. When unset we keep an in-memory DB so the dev
# loop and CI keep zero-setup behaviour.
_DB_PATH = os.environ.get("DD_DB_PATH") or ":memory:"
STORE = LeaderboardStore(_DB_PATH)
