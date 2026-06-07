"""Draft Dogs Arcade — FastAPI app.

Run locally:
  uvicorn backend.app.main:app --reload --port 8000

Wire the Vite dev server to it via vite.config.ts -> server.proxy = {'/api': 'http://localhost:8000'}.

Production env vars:
  DD_ARCADE_HMAC_KEY   — server-side HMAC secret (>=32 random bytes recommended).
  DD_ALLOWED_ORIGINS   — comma-separated list of origins allowed by CORS.
                         e.g. "https://your.github.io,https://draft-dogs.example.com"
                         Defaults to localhost dev origins.
  DD_DB_PATH           — path to the SQLite leaderboard file. When unset, the
                         store stays in-memory (resets on restart).
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .arcade.loader import ensure_loaded
from .arcade.router import router as arcade_router


_DEFAULT_DEV_ORIGINS = ["http://localhost:5180", "http://localhost:5173"]


def _allowed_origins() -> list[str]:
    raw = os.environ.get("DD_ALLOWED_ORIGINS")
    if not raw:
        return _DEFAULT_DEV_ORIGINS
    # Keep dev origins live so a local frontend pointed at a deployed backend
    # still works during testing. Production CORS is otherwise strict against
    # the configured allow-list.
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    return list({*_DEFAULT_DEV_ORIGINS, *extra})


def create_app() -> FastAPI:
    app = FastAPI(title="Draft Dogs Arcade")
    ensure_loaded()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(arcade_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
