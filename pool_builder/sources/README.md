# sources/

Per-league raw-stat fetchers. Each emits a normalized CSV/JSON of
`(player, entity, era, raw_stats)` rows that the candidates + validate +
rate steps downstream consume.

**Source plan per §7:**

| League | Source                    | Licensing      |
|--------|---------------------------|----------------|
| MLB    | Lahman Database           | CC BY-SA       |
| NFL    | nflverse / nflreadr       | open           |
| NHL    | MoneyPuck                 | attribution    |
| NBA    | Kaggle NBA dataset        | open           |
| Soccer | FBref + StatsBomb open    | attribution    |
| Facts  | Wikipedia squad pages     | facts not protected |

Each fetcher should:
1. Pull source data into `cache/{slug}/`.
2. Normalize player names + entity codes against `data/configs/{slug}.json`.
3. Emit `pool_builder/cache/{slug}-raw.json` shape:
   ```json
   [
     { "name": "Pelé", "entity": "BRA", "era": "1970s",
       "positions": ["ST","CAM"], "raw_stats": {"caps": 92, "goals": 77} },
     ...
   ]
   ```
4. Downstream rate.py converts raw stats → DD-OVR.

**Status:** placeholders only. The current MVP uses hand-curated pools in
`data/pools/`. When pool curation outgrows that, drop fetchers here.
