#!/usr/bin/env python3
"""pool_builder/build.py

Orchestrator: validate → optional rate → spinTable repair → emit.
Drops cells from `config.spinTable` that fall below the §6.2 ≥8 density rule.

Usage:
  python pool_builder/build.py data/configs/<slug>.json data/pools/<slug>.json
  python pool_builder/build.py ... --rate         # re-rate via percentile mapping
  python pool_builder/build.py ... --apply        # write changes (else dry-run)
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_DENSITY = 8


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("config")
    parser.add_argument("pool")
    parser.add_argument("--rate", action="store_true", help="Run rate.py before building")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    config_path = Path(args.config)
    pool_path = Path(args.pool)

    # 1. Validate (fatal on errors)
    val = subprocess.run(
        [sys.executable, str(ROOT / "pool_builder/validate.py"), str(config_path), str(pool_path)],
        capture_output=True, text=True,
    )
    print(val.stdout, end="")
    if val.returncode != 0:
        return val.returncode

    # 2. Optional rate
    if args.rate:
        rate_args = [sys.executable, str(ROOT / "pool_builder/rate.py"), str(pool_path)]
        if args.apply:
            rate_args.append("--in-place")
        r = subprocess.run(rate_args, capture_output=True, text=True)
        sys.stderr.write(r.stderr)
        if r.returncode != 0:
            return r.returncode

    # 3. Repair spinTable: drop cells below density.
    config = json.loads(config_path.read_text(encoding="utf-8"))
    pool = json.loads(pool_path.read_text(encoding="utf-8"))
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for p in pool["players"]:
        counts[(p["entity"], p["era"])] += 1
    original = len(config["spinTable"])
    config["spinTable"] = [
        cell for cell in config["spinTable"]
        if counts.get((cell["entity"], cell["era"]), 0) >= MIN_DENSITY
    ]
    pruned = original - len(config["spinTable"])
    if pruned:
        print(f"pruned {pruned} cells below density {MIN_DENSITY}")

    # 4. Emit
    if args.apply:
        config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"wrote {config_path}")
    else:
        print("dry-run (use --apply to write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
