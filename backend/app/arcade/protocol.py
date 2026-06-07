"""Stateless signed-state protocol per §8.

state_blob = base64 JSON of the current draft state. sig = HMAC(server_key,
blob). The server never persists in-progress state; the client carries it
between requests and we verify the signature on each call.

The seed used by the server for spin RNG is derived from the nonce via the
SERVER key, so the client cannot pre-compute future spins by tampering."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any


# In production this MUST come from an env var (or KMS). We fall back to an
# ephemeral key for dev — leaderboards reset across restarts but the protocol
# remains tamper-proof within a session.
def _load_server_key() -> bytes:
    env = os.environ.get("DD_ARCADE_HMAC_KEY")
    if env:
        return env.encode("utf-8")
    return secrets.token_bytes(32)


SERVER_KEY: bytes = _load_server_key()


def sign(blob: bytes) -> str:
    return hmac.new(SERVER_KEY, blob, hashlib.sha256).hexdigest()


def verify(blob: bytes, sig: str) -> bool:
    expected = sign(blob)
    return hmac.compare_digest(expected, sig)


def encode_state(state: dict[str, Any]) -> tuple[str, str]:
    raw = json.dumps(state, sort_keys=True, separators=(",", ":")).encode("utf-8")
    blob = base64.urlsafe_b64encode(raw).decode("ascii")
    sig = sign(raw)
    return blob, sig


def decode_state(blob: str, sig: str) -> dict[str, Any]:
    raw = base64.urlsafe_b64decode(blob.encode("ascii"))
    if not verify(raw, sig):
        raise ValueError("invalid signature")
    return json.loads(raw.decode("utf-8"))


def derive_seed(nonce: str) -> int:
    """Spin seed is HMAC(server_key, nonce) → first 4 bytes as uint32. Even if
    the client tampers with picks, they cannot predict the seed."""
    digest = hmac.new(SERVER_KEY, nonce.encode("utf-8"), hashlib.sha256).digest()
    return int.from_bytes(digest[:4], "big")


def fresh_nonce() -> str:
    return f"{int(time.time()*1000):x}-{secrets.token_hex(8)}"
