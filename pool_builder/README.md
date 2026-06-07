# pool_builder

Pipeline for scaling Draft Dogs Arcade pool curation beyond hand-writing JSON.

```
pool_builder/
  sources/        per-league fetchers (nflverse, Lahman, MoneyPuck, FBref/StatsBomb open,
                  Wikipedia squad lists). Each emits a normalized CSV/JSON of
                  (player, entity, era, raw_stats) tuples.
  candidates/     LLM-assisted candidate proposals: "list the 15 most significant
                  {entity} players of the {era}". Output gets cross-checked against
                  the sources in validate.
  validate.py     dedupe, era sanity (player active in band?), position vocab,
                  OVR distribution per cell (no cell where min OVR > 85),
                  ≥8 per landable cell, cross-checks vs. sources.
  rate.py         percentile → DD-OVR per (position × era × competition),
                  overrides.yaml for icons & pre-data-era legends.
  build.py        orchestrator: emits data/pools/{slug}.json + spin table
                  (only landable cells).
```

## Workflow

1. **Seed**: `candidates/` proposes raw player lists per (entity, era).
2. **Fetch**: `sources/` enriches with stat lines from open data.
3. **Validate**: `python pool_builder/validate.py data/configs/{slug}.json data/pools/{slug}.json`
   — catches structural problems (density, era mismatches, OVR pile-ups).
4. **Rate**: `python pool_builder/rate.py data/pools/{slug}.json --in-place`
   — re-rates OVRs to the canonical distribution per (position × era).
5. **Build**: `python pool_builder/build.py data/pools/{slug}.json data/configs/{slug}.json`
   — re-emits the pool and updates the config's spinTable to drop cells
     that fell below the 8-player density rule.
6. **CI gate**: `npm run calibrate` runs validator + calibrate.py with the
   per-competition tolerance bands in `scripts/calibration-bands.json`.

## What's already wired

- `validate.py` — the script described above. Stricter than scripts/validate-pool.mjs:
  also enforces OVR-distribution sanity per cell.
- `rate.py` — percentile-to-DD-OVR normalizer with optional `--in-place`.
- `build.py` — orchestrator that runs validate → rate → emit.
- `sources/` and `candidates/` are documented placeholders. They need real
  data feeds (nflverse, Lahman, etc.) to be production-ready and are out of
  scope for the current build.
