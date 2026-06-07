#!/usr/bin/env python3
"""pool_builder/rate.py

Re-rates DD-OVR values within a pool using percentile-to-OVR mapping per
(position group × era × competition). Per §4.0:

  DD-OVR (50–99): an era-adjusted, position-normalized overall rating.
  Defined as the player's percentile within (position group × era band ×
  competition), mapped onto 50–99 with a calibrated curve (league-average
  starter ≈ 70, hall-of-fame peak ≈ 95+, inner-circle GOATs 97–99).

This script:
  1. Bins each player into a (position_group, era) bucket using the source
     OVR as a relative-rank signal.
  2. Computes percentile rank within bucket.
  3. Re-maps percentile → DD-OVR via a piecewise curve:
       p < 0.20  → 60-67     (sub-replacement)
       0.20-0.50 → 68-77     (rotation)
       0.50-0.80 → 78-86     (starter)
       0.80-0.95 → 87-92     (all-star)
       0.95-0.99 → 93-96     (superstar)
       0.99+     → 97-99     (icon — also requires `tags: ["icon"]`)
  4. The `overrides.yaml` file lets curators pin specific player IDs to a
     fixed OVR (icons & pre-data-era legends).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


POSITION_GROUP = {
    "GK": "GK", "LB": "DEF", "RB": "DEF", "CB": "DEF", "FB": "DEF", "WB": "DEF",
    "CDM": "MID", "CM": "MID", "CAM": "MID", "LM": "MID", "RM": "MID", "DM": "MID", "AM": "MID",
    "LW": "ATT", "RW": "ATT", "ST": "ATT", "CF": "ATT",
    "QB": "QB", "WR": "SKL", "TE": "SKL",
    "T": "OL", "G": "OL", "C": "OL", "OL": "OL",
    "DL": "F7", "DT": "F7", "DE": "F7", "EDGE": "F7", "LB": "F7", "ILB": "F7", "OLB": "F7",
    "CB": "DB", "S": "DB", "FS": "DB", "SS": "DB", "DB": "DB",
    "D": "D", "LD": "D", "RD": "D", "G": "G",
    "SP": "P", "RP": "P", "P": "P",
    "1B": "IF", "2B": "IF", "3B": "IF", "SS": "IF",
    "LF": "OF", "CF": "OF", "RF": "OF", "OF": "OF", "DH": "OF",
}


def position_group(positions: list[str]) -> str:
    for p in positions:
        if p in POSITION_GROUP:
            return POSITION_GROUP[p]
    return "FREE"


def percentile_to_ovr(p: float) -> float:
    """Piecewise linear ramp from percentile [0,1] to DD-OVR [60,99]."""
    if p < 0.20: return 60 + (p / 0.20) * 7
    if p < 0.50: return 67 + ((p - 0.20) / 0.30) * 10
    if p < 0.80: return 77 + ((p - 0.50) / 0.30) * 9
    if p < 0.95: return 86 + ((p - 0.80) / 0.15) * 6
    if p < 0.99: return 92 + ((p - 0.95) / 0.04) * 4
    return 96 + ((p - 0.99) / 0.01) * 3


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pool")
    parser.add_argument("--in-place", action="store_true",
                        help="Overwrite the pool file; otherwise prints to stdout")
    parser.add_argument("--overrides", default=None,
                        help="Path to overrides.yaml (player_id → fixed_ovr)")
    parser.add_argument("--icon-floor", type=float, default=95.0,
                        help="Minimum DD-OVR for tagged icons (default 95)")
    args = parser.parse_args()

    pool = json.loads(Path(args.pool).read_text(encoding="utf-8"))
    overrides: dict[str, float] = {}
    if args.overrides and Path(args.overrides).exists():
        # Avoid YAML dep — accept a simple "id: ovr" JSON file too.
        try:
            import yaml  # type: ignore
            overrides = yaml.safe_load(Path(args.overrides).read_text(encoding="utf-8")) or {}
        except ImportError:
            overrides = json.loads(Path(args.overrides).read_text(encoding="utf-8"))

    # Bucket by (position_group, era) and rank.
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for p in pool["players"]:
        buckets[(position_group(p.get("positions", [])), p["era"])].append(p)

    for (_grp, _era), rows in buckets.items():
        rows.sort(key=lambda r: r["ovr"])
        n = len(rows)
        for idx, r in enumerate(rows):
            # Percentile within bucket. We use mid-rank to avoid 0/1 extremes.
            pct = (idx + 0.5) / n
            new_ovr = percentile_to_ovr(pct)
            # Icons floor: never demote a tagged icon below icon-floor.
            if "icon" in (r.get("tags") or []):
                new_ovr = max(new_ovr, args.icon_floor)
            # Overrides win unconditionally.
            if r["id"] in overrides:
                new_ovr = float(overrides[r["id"]])
            r["ovr"] = round(max(50.0, min(99.0, new_ovr)))

    out_text = json.dumps(pool, indent=2, ensure_ascii=False)
    if args.in_place:
        Path(args.pool).write_text(out_text, encoding="utf-8")
        print(f"rated {len(pool['players'])} players in-place: {args.pool}", file=sys.stderr)
    else:
        print(out_text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
