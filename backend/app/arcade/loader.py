"""Loads (config, pool) pairs from data/. Per §8 these are CDN-static, but
the API server loads them in-process at boot for replay validation. We cache
the parsed dicts here."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"

_lock = threading.Lock()
_configs: dict[str, dict[str, Any]] = {}
_pools: dict[str, dict[str, Any]] = {}


def _load_all() -> None:
    """Discover every config/pool pair on disk. Cells with a config but no
    pool are skipped — they're 'soon' competitions per the registry."""
    configs_dir = DATA_DIR / "configs"
    pools_dir = DATA_DIR / "pools"
    for cfg_path in configs_dir.glob("*.json"):
        slug = cfg_path.stem
        pool_path = pools_dir / f"{slug}.json"
        if not pool_path.exists():
            continue
        _configs[slug] = json.loads(cfg_path.read_text(encoding="utf-8"))
        _pools[slug] = json.loads(pool_path.read_text(encoding="utf-8"))


def ensure_loaded() -> None:
    with _lock:
        if not _configs:
            _load_all()


def get_config(slug: str) -> dict[str, Any] | None:
    ensure_loaded()
    return _configs.get(slug)


def get_pool(slug: str) -> dict[str, Any] | None:
    ensure_loaded()
    return _pools.get(slug)


def list_live_slugs() -> list[str]:
    ensure_loaded()
    return list(_configs.keys())
