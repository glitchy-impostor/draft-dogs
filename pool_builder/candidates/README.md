# candidates/

LLM-assisted candidate proposals: ask a model for a sized list of "the N
most significant {entity} players of the {era}", then cross-check against
the sources before downstream pipeline steps.

Per §7 honest assessment:

> The LLM-candidate step will produce wrong eras, wrong clubs, and phantom
> players at low but nonzero rates. The validator cross-checks names/years
> against scraped Wikipedia squad pages (facts are not copyrightable) and
> anything failing validation gets quarantined for manual review.

**Plan:**

1. For each `(entity, era)` cell where the spin table demands ≥8 players,
   prompt the model for 12–15 candidates with positions + peak years.
2. Cross-check names + active-year ranges against the Wikipedia squad-list
   fetcher in `sources/`.
3. Quarantine candidates that fail any check; emit successful ones to
   `pool_builder/cache/{slug}-candidates.json` for human review.
4. The human pass becomes `data/pools/{slug}.json` after `rate.py` adds
   DD-OVR.

**Quarantine output shape:**
```json
{
  "approved": [...],
  "rejected": [
    { "name": "Foo", "reason": "active 1995-2005 not in 2010s era band" },
    ...
  ]
}
```

**Status:** placeholder. The current MVP relied on direct curation. When the
catalog grows past hand-feasibility (target: 20+ competitions or pool sizes
in the thousands), wire this in.
