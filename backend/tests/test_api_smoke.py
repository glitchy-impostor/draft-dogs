"""End-to-end protocol test: issue a nonce, replay a hand-built WC XI,
submit, and confirm the leaderboard reflects it."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.arcade.storage import STORE


REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture()
def client():
    # Use a fresh app and clear the store so tests don't bleed into each other.
    STORE.clear()
    app = create_app()
    return TestClient(app)


def _pick_a_valid_wc_xi() -> list[dict]:
    """Build an 11-player XI in 4-3-3 using rows that exist in the pool."""
    pool = json.loads((REPO_ROOT / "data/pools/worldcup.json").read_text(encoding="utf-8"))
    by_id = {p["id"]: p for p in pool["players"]}
    # Choose a Brazil 1970s sweep — that cell has GK, CBs, FBs, mids, attackers.
    slots = [
        ("GK", "wc-bra-1970s-felix"),
        ("LB", "wc-bra-1970s-carlosalberto"),     # natural RB; adjacent LB
        ("LCB", "wc-bra-1970s-pianalto"),
        ("RCB", "wc-bra-1970s-clodoaldo"),        # CDM as CB (adjacent)
        ("RB", "wc-bra-1970s-jairzinho"),         # RW into RB — adjacent
        ("CDM", "wc-bra-1970s-gerson"),
        ("LCM", "wc-bra-1970s-rivellino"),
        ("RCM", "wc-bra-1970s-tostao"),
        ("LW", "wc-bra-1970s-pele"),              # legend; ST as LW (adjacent)
        ("ST", "wc-bra-1970s-jairzinho"),         # dup id intentionally — but we use distinct slots below
        ("RW", "wc-bra-1970s-tostao"),
    ]
    # The dup ids above would fail dup-validation — replace with distinct ids
    # by spreading across cells more carefully. Use a sweep of Brazil-1970s
    # players, all with unique ids and names:
    sweep = [
        ("GK", "wc-bra-1970s-felix"),
        ("LB", "wc-bra-1970s-pianalto"),
        ("LCB", "wc-bra-1970s-carlosalberto"),
        ("RCB", "wc-bra-1970s-clodoaldo"),
        ("RB", "wc-bra-1970s-gerson"),
        ("CDM", "wc-bra-1970s-rivellino"),
        ("LCM", "wc-bra-1970s-tostao"),
        ("RCM", "wc-bra-1970s-jairzinho"),
        ("LW", "wc-bra-1970s-pele"),
        ("ST", "wc-fra-1990s-zidane"),  # different cell — still a valid pool row
        ("RW", "wc-arg-1980s-maradona"),
    ]
    _ = slots, by_id  # silence unused
    return [{"slotKey": k, "playerId": pid} for k, pid in sweep]


def test_competitions_lists_live(client):
    r = client.get("/api/arcade/competitions")
    assert r.status_code == 200
    body = r.json()
    assert "worldcup" in body["live"]
    assert body["sim_version"] >= 1


def test_nonce_then_submit_records_and_ranks(client):
    n = client.get("/api/arcade/nonce", params={"competition": "worldcup", "mode": "classic"})
    assert n.status_code == 200
    nonce = n.json()["nonce"]

    body = {
        "competition": "worldcup",
        "mode": "classic",
        "nonce": nonce,
        "formationId": "4-3-3",
        "picks": _pick_a_valid_wc_xi(),
        "username": "krish",
    }
    r = client.post("/api/arcade/submit", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["rank"] == 1
    assert out["total"] == 1
    assert isinstance(out["score"], int)
    assert "record" in out

    # Double-submit must fail (nonce uniqueness per §6.3).
    r2 = client.post("/api/arcade/submit", json=body)
    assert r2.status_code == 409


def test_invalid_pick_rejected(client):
    n = client.get("/api/arcade/nonce", params={"competition": "worldcup", "mode": "classic"})
    nonce = n.json()["nonce"]
    body = {
        "competition": "worldcup",
        "mode": "classic",
        "nonce": nonce,
        "formationId": "4-3-3",
        "picks": [{"slotKey": "GK", "playerId": "phantom-not-in-pool"}] * 11,
        "username": "krish",
    }
    r = client.post("/api/arcade/submit", json=body)
    assert r.status_code == 400


def test_username_sanitation(client):
    n = client.get("/api/arcade/nonce", params={"competition": "worldcup", "mode": "classic"})
    nonce = n.json()["nonce"]
    body = {
        "competition": "worldcup",
        "mode": "classic",
        "nonce": nonce,
        "formationId": "4-3-3",
        "picks": _pick_a_valid_wc_xi(),
        "username": "",
    }
    r = client.post("/api/arcade/submit", json=body)
    assert r.status_code == 400


def test_daily_seed_is_deterministic_but_nonces_unique(client):
    """Daily seed must be the same for every user playing today (fair puzzle),
    but the nonce must differ per request so multiple users can submit their
    own row to the daily leaderboard."""
    a = client.get("/api/arcade/daily", params={"competition": "worldcup"}).json()
    b = client.get("/api/arcade/daily", params={"competition": "worldcup"}).json()
    assert a["seed"] == b["seed"]
    assert a["nonce"] != b["nonce"]
    # Both nonces should share the daily prefix (so the server can verify them).
    assert a["nonce"].startswith(f"daily:worldcup:{a['day']}")
    assert b["nonce"].startswith(f"daily:worldcup:{b['day']}")


def test_two_users_can_both_submit_daily(client):
    """The original bug: daily nonces were identical for everyone, so the
    second user always got 409 'this run has already been submitted'."""
    a_nonce = client.get("/api/arcade/daily", params={"competition": "worldcup"}).json()["nonce"]
    b_nonce = client.get("/api/arcade/daily", params={"competition": "worldcup"}).json()["nonce"]
    body_a = {
        "competition": "worldcup", "mode": "daily", "nonce": a_nonce,
        "formationId": "4-3-3", "picks": _pick_a_valid_wc_xi(), "username": "alice",
    }
    body_b = {
        "competition": "worldcup", "mode": "daily", "nonce": b_nonce,
        "formationId": "4-3-3", "picks": _pick_a_valid_wc_xi(), "username": "bob",
    }
    # Use distinct x-forwarded-for so the per-IP daily cap doesn't reject the second.
    ra = client.post("/api/arcade/submit", json=body_a, headers={"x-forwarded-for": "10.0.0.1"})
    rb = client.post("/api/arcade/submit", json=body_b, headers={"x-forwarded-for": "10.0.0.2"})
    assert ra.status_code == 200, ra.text
    assert rb.status_code == 200, rb.text
    # Both runs should appear on the daily leaderboard with the same record
    # (same seed → identical sim outcome for identical XIs).
    assert ra.json()["record"] == rb.json()["record"]


def test_leaderboard_returns_rows(client):
    # Submit once first
    nonce = client.get("/api/arcade/nonce", params={"competition": "worldcup", "mode": "classic"}).json()["nonce"]
    body = {
        "competition": "worldcup", "mode": "classic", "nonce": nonce,
        "formationId": "4-3-3", "picks": _pick_a_valid_wc_xi(), "username": "krish",
    }
    client.post("/api/arcade/submit", json=body)
    lb = client.get("/api/arcade/leaderboard", params={"competition": "worldcup", "mode": "classic"})
    assert lb.status_code == 200
    body = lb.json()
    assert body["total"] >= 1
    assert body["rows"][0]["username"] == "krish"
