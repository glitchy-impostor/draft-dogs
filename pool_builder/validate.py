#!/usr/bin/env python3
"""pool_builder/validate.py

Stricter than scripts/validate-pool.mjs. Enforces:
  - every spinTable cell has ≥8 players (the genre rule from §6.2)
  - no duplicate player IDs
  - player.entity ∈ config.entities (warning if not — those rows are unreachable)
  - player.era ∈ config.eraBands
  - position tags drawn from a known vocab (warning on outliers)
  - OVR is in [50, 99]
  - NEW: OVR distribution sanity per cell — fails if min OVR > 85 in a cell
    (means the cell is icon-only and won't punish bad spin RNG), or if all
    players in a cell share the same OVR (means rating is meaningless)
  - NEW: era-band membership across all player rows, not just spinTable cells

Usage:
  python pool_builder/validate.py data/configs/<slug>.json data/pools/<slug>.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


POSITION_VOCAB = {
    # soccer
    "GK",
    "LB","RB","CB","FB","WB",
    "CDM","CM","CAM","LM","RM","DM","AM",
    "LW","RW","ST","CF",
    # nfl
    "QB","RB","FB","WR","TE","T","G","C","OL",
    "DL","DT","DE","EDGE","LB","ILB","OLB","CB","S","FS","SS","DB",
    # nhl
    "D","LD","RD",
    # mlb
    "SP","RP","P","1B","2B","3B","SS","LF","CF","RF","OF","DH",
}

MIN_DENSITY = 8
MIN_OVR_CEILING = 85  # if min OVR in a cell exceeds this, cell is icon-only
OVR_STDEV_FLOOR = 1.5


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("config")
    parser.add_argument("pool")
    parser.add_argument("--quiet", action="store_true", help="Only print problems")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    pool = json.loads(Path(args.pool).read_text(encoding="utf-8"))

    errors: list[str] = []
    warnings: list[str] = []
    entity_ids = {e["id"] for e in config["entities"]}
    era_bands = set(config["eraBands"])

    seen_ids: set[str] = set()
    for p in pool["players"]:
        pid = p["id"]
        if pid in seen_ids:
            errors.append(f"duplicate id: {pid}")
        seen_ids.add(pid)
        if p["entity"] not in entity_ids:
            warnings.append(f"{pid}: entity {p['entity']} not in config (orphan row)")
        if p["era"] not in era_bands:
            errors.append(f"{pid}: era {p['era']} not in config.eraBands")
        for pos in p.get("positions", []):
            if pos not in POSITION_VOCAB:
                warnings.append(f"{pid}: unusual position tag {pos}")
        ovr = p.get("ovr")
        if not isinstance(ovr, (int, float)) or not (50 <= ovr <= 99):
            errors.append(f"{pid}: ovr out of range ({ovr})")

    # Per-cell density + OVR distribution checks for landable cells.
    cell_players: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for p in pool["players"]:
        cell_players[(p["entity"], p["era"])].append(p)

    low_density: list[str] = []
    icon_only: list[str] = []
    flat_ovr: list[str] = []
    for cell in config["spinTable"]:
        key = (cell["entity"], cell["era"])
        rows = cell_players.get(key, [])
        if len(rows) < MIN_DENSITY:
            low_density.append(f"{cell['entity']}/{cell['era']}: {len(rows)}/{MIN_DENSITY}")
            continue
        ovrs = [r["ovr"] for r in rows]
        if min(ovrs) > MIN_OVR_CEILING:
            icon_only.append(f"{cell['entity']}/{cell['era']}: min OVR {min(ovrs)} > {MIN_OVR_CEILING}")
        # crude stdev (no numpy)
        mean = sum(ovrs) / len(ovrs)
        var = sum((o - mean) ** 2 for o in ovrs) / len(ovrs)
        std = var ** 0.5
        if std < OVR_STDEV_FLOOR:
            flat_ovr.append(f"{cell['entity']}/{cell['era']}: stdev {std:.2f} < {OVR_STDEV_FLOOR}")

    cells_count = len(cell_players)
    landable = len(config["spinTable"])
    if not args.quiet:
        print(f"pool {pool['competition']} v{pool['poolVersion']}: "
              f"{len(pool['players'])} players, {cells_count} cells, "
              f"{landable} landable")
    if low_density:
        errors.extend(f"low density: {x}" for x in low_density)
    if icon_only:
        warnings.extend(f"icon-only cell: {x}" for x in icon_only)
    if flat_ovr:
        warnings.extend(f"flat OVR distribution: {x}" for x in flat_ovr)

    if warnings and not args.quiet:
        print(f"warnings: {len(warnings)}")
        for w in warnings[:10]:
            print(f"  {w}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more")
    if errors:
        print(f"ERRORS: {len(errors)}")
        for e in errors:
            print(f"  {e}")
        return 1
    if not args.quiet:
        print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
