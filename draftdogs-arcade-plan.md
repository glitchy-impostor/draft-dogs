# DraftDogs Arcade — "Perfect Season" Games
## Planning Document for Claude Code

**Status:** Planning / pre-build
**Owner:** Krish
**Target home:** DraftDogs domain (existing React + Vite frontend on Vercel, FastAPI backend on Railway, Postgres)
**Monetization:** None. Free, no ads, no accounts.
**Date:** June 6, 2026 — note: the 2026 World Cup kicks off **June 11, 2026**. This drives the roadmap (Section 13).

---

## 0. Executive Summary

We are building a family of "draft-a-dream-team, simulate a perfect season" games, modeled on **38-0.app** (Premier League) and **82-0.com** (NBA), expanded into a single config-driven engine that powers **14 competitions**:

- **Soccer (season format):** Premier League (38-0), LaLiga (38-0), Serie A (38-0), Bundesliga (34-0), Ligue 1 (34-0), MLS (34-0), Mixed Bag / World League (38-0)
- **Soccer (tournament format):** Champions League (15-0), World Cup (8-0), Euros (7-0), Copa América (6-0)
- **US sports (season format):** NBA (82-0), NHL (82-0), NFL (17-0), MLB (162-0)

**The single most important architectural decision in this document:** there is ONE game engine and ONE data schema. A "competition" is a JSON config file plus a player pool file. The code must never contain `if league == "epl"` logic outside the config layer. If this is done right, competitions 3 through 14 are content work, not engineering work.

**The single most important non-engineering fact:** the code is roughly 20% of this project. Player pool curation (thousands of player entries with eras, positions, and ratings) is 80%. The plan treats pool-building as a first-class engineering pipeline with its own tooling and validation, not an afterthought.

**Sequencing (locked by Krish):** all 14 competitions are built **in parallel** — viable precisely because the engine is config-driven and pool-building is a pipeline. Every competition sits behind a config flag and goes live when it passes its launch gate (Section 13). The flag system is the QA safety valve: build everything simultaneously, but never expose a pool that hasn't passed validation. Human-review bandwidth (the only truly serial resource) is prioritized WC → EPL → NBA/NFL → rest, because the World Cup window (June 11 – July 19) is the one calendar-bound opportunity.

### 0.1 — Brand & Naming (locked: everything under the Draft Dogs brand)

- **Umbrella:** **Draft Dogs Arcade**, living at `draftdogs domain → /arcade`.
- **Game naming pattern:** `Draft Dogs {RECORD}: {Competition}` — *Draft Dogs 38-0: Premier League*, *Draft Dogs 8-0: World Cup*, *Draft Dogs 82-0: NBA*, *Draft Dogs 17-0: NFL*, *Draft Dogs 38-0: World League* (mixed bag). The record string is descriptive (a scoreline), used under the Draft Dogs house mark — this is what keeps distance from "38-0"/"82-0" as third-party brand names while staying instantly legible.
- **Universal perfection tier:** **TOP DOG** 🐾. Sport-flavored tier ladders remain per competition (Relegated → … → Invincible), but a perfect record in *any* competition awards the brand-unifying TOP DOG badge — it's the share-card flex and the cross-competition collection hook ("Top Dog in 3 of 14").
- League/competition names appear nominatively in subtitles and disclaimers only; the brand mark on every surface (share cards, OG images, hub) is always Draft Dogs (see §11).

---

## 1. Reverse Engineering

### 1.1 — 38-0.app (Premier League)

**What it is:** Spin a wheel → get a random (Premier League club × era). Draft one player from that club/era into an open slot in your formation. Repeat for 11 rounds. Simulate a 38-game season; the result is presented as a projected record and a **simulated league table position** (user reports include "won the league," "came 2nd," "finished 7th" — the sim places your XI in a full 20-team table, not just a W-D-L line).

**Observed/inferred mechanics:**
- 11 rounds, one per slot in a chosen formation (4-3-3 etc.)
- Spin yields (club, era) pairs; player pool is club-and-era keyed
- Limited rerolls (a "Hard mode" with no rerolls exists per user forum reports; competitor sites confirm the genre standard of ~1–2 era rerolls + 1–2 team rerolls per game)
- Positional fit matters: placing a CB at striker tanks the rating
- Output: W-D-L record over 38 games + league table placement + tier label
- Leaderboard at `/leaderboard` with username submission

**Inferred tech stack:**
- Next.js App Router (the `opengraph-image?<hash>` / `twitter-image?<hash>` URLs are the Next.js 13+ generated-metadata-image signature)
- Fully client-rendered game (the page shell is just "Loading...")
- Routes: `/`, `/game`, `/leaderboard`
- Leaderboard implies a small persistence layer (likely Vercel KV / Postgres / Supabase)
- Player data almost certainly ships as a static JSON bundle to the client

### 1.2 — 82-0.com (NBA)

**What it is:** Slot machine → (franchise × decade). Pick one player from that franchise-decade. **5 rounds, 5 players**, with a "Decades Rule": no decade repeats (pool of decades: 1960s–2020s; the machine deals 5 of the 7). Aggregate stats → strength rating → non-linear win curve → record out of 82.

**Documented mechanics (from their How to Play page):**
- 5 roster spots, no positional restrictions, no synergy/chemistry mechanics
- Rating = cumulative era-adjusted totals across 5 box-score categories: PTS, REB, AST, STL, BLK — each player evaluated at their **peak within their decade**
- Explicit **era adjustment**: 30 PPG in the 1960s ≠ 30 PPG in the 2020s
- **Non-linear win curve**: each marginal win costs more rating; a deficiency in any one category can block 82-0 regardless of scoring
- Skips: exactly **1 team skip + 1 decade skip** per game
- Two modes: **Classic** (stats visible) and **HoopIQ** (stats hidden, draft from memory)

**Inferred tech stack:**
- `meta-generator: v0.app` → built with Vercel's v0 → Next.js + Tailwind/shadcn on Vercel
- Client-side game, static player JSON
- Ko-fi donation link, feedback Google Form, no ads, no accounts
- **Footer disclaimer worth copying in spirit:** "82-0.com is an independent project and is not affiliated with, endorsed by, or sponsored by the National Basketball Association."

### 1.3 — The genre (read this before building)

This is already a clone genre. Independent live implementations include 38-0.app, 38-0-0.com (FIFA-ratings-based, ad-supported), roadto38.com (adds chemistry: same-club links and "legendary duo" bonuses, plus simulated post-hoc player stat lines), and beinvincible.xyz (which already has a **World Cup mode** — "spin for a nation and World Cup, build your international XI, win the tournament" — plus WhatsApp share text and an Instagram share card).

Three takeaways:
1. **Game mechanics are not protectable and the field proves it.** Four sites cloned 38-0 within months of each other. Our risk surface is not "copying the game" — it's trademarks, assets, and data provenance (Section 12).
2. **The differentiators that exist in the wild:** league-table simulation (38-0.app), era-adjusted raw stats (82-0), chemistry links + simulated stat lines (roadto38), share cards (beinvincible). We should cherry-pick: positional-fit OVR engine + chemistry-lite + share cards + **multi-sport breadth, which nobody has**.
3. **Multi-sport under one roof is the actual moat.** Nobody has EPL + WC + NBA + NFL + MLB + NHL on one domain. That, plus DraftDogs' existing data pipelines, is the pitch.

---

## 2. The Universal Game Loop

Every competition reduces to the same state machine:

```
CONFIGURE → (SPIN → [REROLL?] → PICK) × N_ROUNDS → SIMULATE → RESULT → SHARE/LEADERBOARD
```

- **CONFIGURE:** player chooses competition, mode (Classic / Expert / Hard / Daily), and — for soccer — formation.
- **SPIN:** RNG deals an `(entity, era)` pair. Entity = club / franchise / nation. Era = decade or season-band, depending on competition config.
- **REROLL:** budgeted per config (default: 1 entity reroll + 1 era reroll; Hard mode: 0).
- **PICK:** player chooses one player from `pool[entity][era]` and assigns them to an open slot. Slot legality rules come from config (soccer: any player into any slot but fit-penalized; NBA: free-for-all; NFL/NHL/MLB: slot-typed).
- **Repeat-constraint:** per config — NBA inherits the "no decade repeats" rule; soccer inherits "anything can repeat" (genre standard).
- **SIMULATE:** one of two engines — `season` (N games → record + table/tier) or `tournament` (group + bracket → run outcome). Both consume the same TeamRating.
- **RESULT:** record, tier label, per-player flavor stat lines (optional v2), share card.

### Modes (uniform across all competitions)
| Mode | Ratings/stats visible? | Rerolls | Seed |
|---|---|---|---|
| Classic | Yes | Per config | Random |
| Expert (a.k.a. "IQ") | No — names, positions, eras only | Per config | Random |
| Hard | Yes | Zero | Random |
| Daily | Yes | Per config | `hash(date + competition)` — same spins for everyone, one attempt per day, Wordle-style share text |

All four modes ship at launch (locked). Game start is an explicit mode-choice screen — Classic visually preselected but never auto-started, Expert one tap away, last-played mode remembered per device. (Do **not** silently default to Expert: hidden ratings disorient a first-timer who doesn't know the game yet; Expert is the flex mode for the second run onward.) Daily mode is the retention loop: seed = `HMAC(server_key, date + competition)`, identical spins for everyone, one submitted run per competition per day, Wordle-style emoji share text.

---

## 3. Competition Matrix

This is the canonical config table. Every row becomes a `config/{slug}.json`.

| Slug | Competition | Format | Target | Games | Rounds (roster) | Entities | Era axis |
|---|---|---|---|---|---|---|---|
| `epl` | Premier League | season+table | 38-0 | 38 | 11 (formation) | ~25 clubs (incl. historic PL clubs) | PL eras: 92–99, 00s, 10s, 20s |
| `laliga` | LaLiga | season+table | 38-0 | 38 | 11 | ~22 clubs | 80s, 90s, 00s, 10s, 20s |
| `seriea` | Serie A | season+table | 38-0 | 38 | 11 | ~22 clubs | 80s, 90s, 00s, 10s, 20s |
| `bundesliga` | Bundesliga | season+table | 34-0 | 34 | 11 | ~20 clubs | 80s, 90s, 00s, 10s, 20s |
| `ligue1` | Ligue 1 | season+table | 34-0 | 34 | 11 | ~20 clubs | 80s, 90s, 00s, 10s, 20s |
| `mls` | MLS | season+table | 34-0 | 34 | 11 | 30 clubs | 96–05, 06–14, 15–22, 23+ |
| `ucl` | Champions League | tournament | 15-0 | 15 | 11 | ~32 historic European clubs | 90s, 00s, 10s, 20s |
| `worldcup` | World Cup | tournament | 8-0 | 8 | 11 | 48 nations (≈28 deep + thin tail) | 70s, 80s, 90s, 00s, 10s, 20s |
| `euros` | Euros | tournament | 7-0 | 7 | 11 | ~24 nations | 80s, 90s, 00s, 10s, 20s |
| `copa` | Copa América | tournament | 6-0 | 6 | 11 | ~12 nations | 80s, 90s, 00s, 10s, 20s |
| `mixedbag` | World League (mixed) | season+table | 38-0 | 38 | 11 | union of all soccer clubs | per source league |
| `nba` | NBA | season | 82-0 | 82 | 5 (free) | 30 franchises | 1960s–2020s, no repeats |
| `nhl` | NHL | season | 82-0 | 82 | 6 (LW,C,RW,D,D,G) | 32 franchises | 70s–20s |
| `nfl` | NFL | season | 17-0 | 17 (+3 playoff epilogue) | 8 (typed, see §4.3) | 32 franchises | 70s–20s |
| `mlb` | MLB | season | 162-0 | 162 | 10 (typed, see §4.5) | 30 franchises | 1900s–2020s (banded) |

**Format notes (verified June 2026):**
- Bundesliga is 18 clubs / 34 matches; Ligue 1 has been 18 clubs / 34 matches since 2023–24; MLS 2026 is 30 clubs / 34 matches each. Use current formats for the target record — "34-0" for Ligue 1 even though most of its history was 38, because the brand promise is "a perfect season *today*."
- Champions League (Swiss format): 8 league-phase wins (top-8 finish skips the playoff) + R16/QF/SF over two legs + final = **15-0**. Offer a "Classic 13-0" (group-stage era) variant later if desired, but ship one format.
- World Cup 2026: 48 teams, 3 group games + R32/R16/QF/SF/Final = **8 wins**. Euros: 3 + 4 = **7**. Copa América: 3 group + QF/SF/F = **6**.
- NFL: target is the 17-0 regular season; perfection unlocks a 3-game playoff epilogue for the "20-0 Immortals" super-tier (nod to the '72 Dolphins without colliding with their 17-0 total).
- NBA decades rule: keep 82-0.com's signature constraint (5 picks dealt from 7 decades, no repeats). It's their best design idea — it forces engagement with the 60s/70s instead of five 2010s superstars.

**Mixed Bag design decision:** frame it as a fictional 20-team "World League" season (38-0). Spins deal (club, era) from the union of all soccer pools, weighted so no single league dominates (cap any league at ~30% of spins). This mode is nearly free once the soccer pools exist — it's a pool-union + config file.

---

## 4. Sport-Specific Roster & Rating Design

### 4.0 — One rating currency: DD-OVR

82-0 sums raw box stats; 38-0 uses FIFA-style OVRs with positional fit. Raw-stat summation does **not** generalize: NFL positions have incomparable stat lines (QB yards vs. edge sacks), NHL goalies don't score, MLB pitchers and hitters live in different universes. So the engine consumes exactly one number per player:

> **DD-OVR (50–99):** an era-adjusted, position-normalized overall rating. Defined as the player's percentile within (position group × era band × competition), mapped onto 50–99 with a calibrated curve (league-average starter ≈ 70, hall-of-fame peak ≈ 95+, inner-circle GOATs 97–99).

Raw stats still exist in the schema — they're displayed on player cards in Classic mode and used to *derive* DD-OVR — but the simulator never sees them. This is what makes one engine serve 14 competitions, and it sidesteps shipping EA's FIFA/Madden rating numbers verbatim (Section 12).

### 4.1 — Soccer (all 11 soccer competitions)

- **Roster:** 11 slots from a chosen formation. Ship three formations in v1: 4-3-3, 4-4-2, 3-5-2.
- **Positions:** players carry 1–3 eligible positions (`["ST","LW"]`). Fit multiplier when slotted:
  - natural position: ×1.00
  - adjacent (config-defined adjacency map, e.g. RW→ST, CM→CDM, CB→FB): ×0.85
  - wrong line (CB→ST, GK→anything outfield): ×0.55
- **GK is special:** a team without a real GK must be severely punished. The slot weight on GK is high (see §5) and an outfielder in goal gets ×0.40.
- **Chemistry-lite (v2, behind a flag):** +1 OVR-equivalent per same-club-same-era pair (cap +5), plus a hand-curated `duos.json` of legendary pairs (Xavi–Iniesta, Maldini–Nesta…) worth +2 each. Ship v1 without it; the flag exists so the sim version number changes when it lands (leaderboards are per sim-version).

### 4.2 — NBA

- **Roster:** 5 slots, positionless (faithful to 82-0).
- **Decades rule:** spins deal 5 distinct decades from {1960s…2020s}.
- **Card stats:** PTS/REB/AST/STL/BLK at decade-peak, plus the era-adjusted percentile per category. DD-OVR derived from a weighted blend of the five category percentiles — preserving 82-0's "a hole in any category blocks perfection" property via a **balance penalty** (see §5) rather than per-category thresholds.

### 4.3 — NFL

8 typed slots — the minimum that feels like football without becoming a 22-slot slog:

| Slot | Eligible |
|---|---|
| QB | QB |
| RB | RB/FB |
| WR1, WR2 | WR |
| TE | TE |
| OL | T/G/C |
| Front-7 | DL/EDGE/LB |
| DB | CB/S |

Rating basis: per-position era percentiles. Skill positions from nflverse stats (he/we already run nflfastR workers); OL and defense need curated ratings — career AV from the nflreadr draft-picks dataset is a usable anchor for cross-position value, topped up with manual curation for pre-1999 legends. Accept that NFL is the heaviest curation lift among US sports.

### 4.4 — NHL

6 typed slots: LW, C, RW, D, D, G. Skater OVR from era-adjusted points + curated defensive value; goalie OVR from era-adjusted SV%/GSAA. MoneyPuck (already in the DraftDogs stack) covers 2008+; earlier eras are curated.

### 4.5 — MLB

10 typed slots: SP, C, 1B, 2B, 3B, SS, LF, CF, RF, DH. The **Lahman Database** is openly licensed (CC BY-SA), covers 1871–present, and is the single best data situation of any league in this project. Derive OVR from era-adjusted OPS+-style percentiles for hitters and ERA+-style for the SP. Baseball-Reference's downloadable WAR tables are an optional enrichment.

---

## 5. Simulation Engine Spec

One engine, two run modes (`season`, `tournament`), pure functions, fully deterministic given `(seed, picks, config, sim_version)`.

### 5.1 — Team rating

```
slot_score_i = OVR_i × fit_i                      # fit from §4.1, =1.0 for non-soccer
base        = Σ (w_i × slot_score_i) / Σ w_i      # w_i = slot weights from config
                                                  # soccer default: GK 1.3, DEF 1.0, MID 1.1, ATT 1.2
balance_pen = λ × (max(0, base − min_i slot_score_i))    # punish one weak link, λ ≈ 0.35
chem        = chemistry bonus (0 in v1)
R           = clamp(base − balance_pen + chem, 50, 99)
```

The balance penalty is the cross-sport generalization of 82-0's "a deficiency in even one category can prevent a perfect season."

### 5.2 — Season mode

```
p_win(R)  = 1 / (1 + exp(−k × (R − R50)))         # per-game win prob, before opponent adj
            calibrate: R50 ≈ 82, k ≈ 0.28  (tune in §5.4)
For g in 1..G:
    opp_g   ~ opponent strength from config distribution (historical-ish spread, seeded)
    p_g     = elo_blend(p_win(R), opp_g)
    result  ~ Bernoulli(p_g)        # soccer: trinomial W/D/L with draw band
```
- Soccer adds draws: draw probability peaks (~26%) when `p_g ≈ 0.5` and decays toward 0 as `p_g → 1`.
- **League table flavor (soccer season modes):** the other 17–19 clubs in the table are name-safe fictional-ish opponents ("Merseyside Red", "North London", …) or simply "Rivals 1–19" with seeded strengths; play the double round-robin, render the full table. This reproduces 38-0.app's best feature (finishing "7th" stings more than "29-6-3").
- **Calibration invariant:** a theoretically perfect draft (99 OVR every slot, perfect fit) should land the perfect record in roughly **30–50% of simulations**; a greedy-optimal *realistic* draft (subject to spin RNG) should hit it ~2–5% of games. Perfection must be possible, rare, and luck-flavored — that's the genre's compulsion loop.

### 5.3 — Tournament mode

```
Stages from config, e.g. worldcup: [group×3, R32, R16, QF, SF, F]
Opponent strength ramps per stage: group ~ N(72,6) → final ~ N(93,3)
Single elimination after group; a loss ends the run; group losses just break perfection.
Output: run summary ("Lifted the trophy, 8-0", "Out in the QF, 5-1"), per-match scorelines for flavor.
```

### 5.4 — Tiers & calibration

Tier labels are config-supplied arrays mapped from final results. Soccer-season example: `Relegated → Mid-table → Top Four → Title Race → Champions → Invincible (38-0)`. NFL: `… → 17-0 Perfect Season → 20-0 Immortals`. Write a calibration script (`scripts/calibrate.py`) that Monte-Carlos 100k drafts per competition and prints the record distribution; tune `k`, `R50`, opponent spreads, and draw bands until the §5.2 invariant holds. **Run this in CI** — a pool edit that silently makes 38-0 trivial is a balance bug.

### 5.5 — Determinism & versioning

- All RNG from a single `seed` via a splittable PRNG (e.g. PCG / xoshiro port). No `Math.random()` anywhere in game logic.
- `sim_version` integer in every result; leaderboards filter on it. Bump on any change to formulas, weights, or pools that affects outcomes.

---

## 6. Data Model

### 6.1 — Competition config (`data/configs/{slug}.json`)

```jsonc
{
  "slug": "worldcup",
  "name": "World Cup 8-0",
  "sport": "soccer",
  "run_mode": "tournament",                  // "season" | "tournament"
  "target": { "games": 8, "label": "8-0" },
  "stages": ["group","group","group","r32","r16","qf","sf","final"],
  "rounds": 11,
  "roster": { "type": "formation", "formations": ["4-3-3","4-4-2","3-5-2"] },
  "era_bands": ["1970s","1980s","1990s","2000s","2010s","2020s"],
  "era_repeat": true,                        // false => NBA decades rule
  "rerolls": { "entity": 1, "era": 1 },
  "slot_weights": { "GK":1.3, "DEF":1.0, "MID":1.1, "ATT":1.2 },
  "tiers": [ {"min_wins":8,"label":"Immortal XI"}, {"stage":"final","label":"Runners-up"}, ... ],
  "sim": { "k":0.28, "r50":82, "draw_peak":0.26, "opp": {...} },
  "entity_weights": { "brazil": 1.0, "curacao": 0.4, ... }   // optional spin weighting
}
```

### 6.2 — Player pool (`data/pools/{slug}.json`)

```jsonc
{
  "competition": "worldcup",
  "pool_version": 3,
  "entities": [ { "id":"brazil", "name":"Brazil", "colors":["#FFDC00","#009C3B"] } ],
  "players": [
    {
      "id": "wc-bra-1970-pele",
      "name": "Pelé",
      "entity": "brazil",
      "era": "1970s",
      "positions": ["ST","CAM"],
      "ovr": 99,
      "stats": { "caps": 92, "goals": 77 },     // display-only, sport-specific shape
      "tags": ["icon"]                          // optional: duo/chemistry hooks, badges
    }
  ]
}
```

Rules: player `id`s are stable forever (leaderboard replays reference them); one player may appear in multiple eras/entities as separate rows (Ronaldo at Real Madrid 00s and Man Utd 00s are two rows in two pools — and 90s + 00s Brazil in the WC pool); minimum pool density target = **8 players per (entity × era) cell** that the spinner can land on (cells below 8 are excluded from the spin table at build time — never show the user a 3-player choice).

### 6.3 — Postgres (server)

```sql
-- Stateless protocol (§8): NOTHING is stored during play. One table, written once per finished run.
submitted_runs(
  id uuid pk,
  nonce bytea unique,        -- from the signed state blob; uniqueness = one submit per run
  competition text, mode text, sim_version int, pool_version int,
  username text check (length(username) <= 20),
  score int, record text,
  team jsonb,                -- final picks (player ids + slots), enables replay/inspection
  day date null,             -- daily mode
  created_at timestamptz default now()
);
-- index: (competition, mode, sim_version, score desc); partial index on (day) for daily boards
```

Score = wins ×1000 − losses, ties broken by team rating ascending (lower-rated team achieving the same record ranks higher — rewards drafting skill over spin luck).

---

## 7. The Pool Pipeline (the actual hard part)

Rough sizing at 8–15 players per landable (entity × era) cell:

| Pool | Cells (approx) | Players (approx) |
|---|---|---|
| World Cup (28 deep nations × ~4 usable eras) | ~110 | 1,000–1,400 |
| Each big-5 soccer league | ~80–100 | 900–1,400 |
| MLS | ~70 | 700 |
| UCL / Euros / Copa | mostly **reuse** league + WC rows re-keyed | low marginal |
| NBA | 30 × 7 = 210 (sparse pre-expansion) | ~1,500 |
| NFL / MLB / NHL | 150–250 each | 1,200–2,000 each |

That's **~10–14k curated player rows** at full scope. Hand-writing JSON is not viable; treat pools as a build pipeline:

```
pool_builder/
  sources/        # per-league fetchers: nflverse, Lahman, MoneyPuck, Kaggle NBA,
                  # FBref/StatsBomb-open for modern soccer, Wikipedia squad lists for facts
  candidates/     # LLM-assisted candidate generation per (entity, era):
                  #   "list the 15 most significant {club} players of the {era}, positions, peak years"
  validate.py     # dedupe, era sanity (player active in band?), position vocab check,
                  #   OVR distribution check per cell (no cell where min OVR > 85),
                  #   min-density rule, cross-checks candidate facts vs. source data where available
  rate.py         # percentile → DD-OVR mapping per (position × era × competition),
                  #   manual override file (overrides.yaml) for icons & pre-data-era legends
  build.py        # emits data/pools/{slug}.json + a spin table (only landable cells)
```

Honest assessment of the LLM-candidate step: it will produce wrong eras, wrong clubs, and phantom players at low but nonzero rates. The validator cross-checks names/years against scraped Wikipedia squad pages (facts are not copyrightable) and anything failing validation gets quarantined for manual review. Budget real human review time for the top ~6 entities per competition — those are the cells 80% of spins care about. **Do not skip `validate.py` to ship faster; a fake player on a card kills credibility instantly in this audience.**

Reuse map (big savings): UCL pool ≈ big-5 league rows re-keyed to European-era cells; Euros/Copa ≈ WC nation rows filtered by confederation; Mixed Bag = union of league pools with spin weights. Build league pools with reuse in mind: every soccer row carries `nation` and `club` so re-keying is a script, not a re-curation.

---

## 8. Architecture & DraftDogs Integration

**Fit with the existing stack — no new infrastructure:**

- **Frontend:** new route group in the existing React + Vite app: `/arcade` (hub) and `/arcade/{slug}` (game). Code-split the arcade bundle so the analytics platform's load time is untouched.
- **Backend:** new FastAPI router `arcade/` in the existing Railway service. Postgres tables from §6.3.
- **Workers:** `pool_builder/` joins the existing worker family (nflfastR, Cricsheet, MoneyPuck) — same repo conventions, same scheduling approach, except pools build on demand, not on cron.
- **Brand separation:** the analytics platform is the serious product; the arcade is the viral top-of-funnel. Keep them visually related but distinct (own nav section, "DraftDogs Arcade" wordmark). Every results/share screen links back to the analytics platform — that's the whole growth thesis.

**Compute reality check (this section was rethought after a cost review):** the simulation is a few thousand RNG draws plus arithmetic — **microseconds per game**, cheaper than rendering one DraftDogs analytics chart. Even the heaviest sim (MLB: 162 games + table flavor) is sub-millisecond. CPU was never the cost; the cost in a naive design is **per-action state storage** (~13 Postgres writes per game). So the backend is stateless:

**Stateless signed-state protocol** (tamper-proof leaderboard at ~zero marginal cost):

```
POST /api/arcade/act
  body:    { state_blob?, sig?, action }       # action: start | spin | reroll | pick | simulate
  returns: { state_blob', sig', view }          # view = what the client may see this round

POST /api/arcade/submit
  body:    { state_blob, sig, username }        # finished runs only
  effect:  verify sig → replay sim (µs) → INSERT one row → return rank

GET  /api/arcade/leaderboard?competition&mode&day   → top N + around-me (cacheable, 30s TTL)
```

Mechanics:
- `state_blob` = base64 JSON `{nonce, competition, mode, round, picks, rerolls_used, day}`; `sig = HMAC(server_key, blob)`. The client carries its own state; the server stores **nothing** during play.
- The RNG seed is derived server-side as `HMAC(server_key, nonce)` and never leaves the server — the client cannot look ahead at future spins, and tampering with the blob breaks the signature.
- Pools/configs are **static versioned JSON on the Vercel CDN** — the backend never serves data files. The server loads pools into memory at boot (a few MB) for pick validation and sim replay.
- DB activity per game: **one INSERT, only on leaderboard submit.** The `nonce` unique constraint makes each run submittable exactly once.
- Scale math: a viral day of 100k games × ~13 actions ≈ 1.3M requests ≈ 15 rps average / ~150 rps peak — comfortably one small Railway instance, each request sub-millisecond of CPU. Cost is effectively the existing Railway bill; the leaderboard endpoint behind a 30s cache absorbs read spikes.
- Rate-limit `submit` by IP; Daily mode additionally enforces one submitted run per competition per IP per day.

**Offline/degraded mode:** the game must also run fully client-side (pools are public JSON anyway) when the API is down — you just can't submit to the leaderboard. Implement the engine as a **shared pure TypeScript module** executed in the browser for instant feedback *and* ported/mirrored in Python for server validation — or better, run the same TS engine server-side via a tiny Node sidecar… **Decision:** simplest honest answer is to write the engine once in TypeScript and run it on the server with Node inside the FastAPI service via a subprocess, OR write it twice with a golden-test suite asserting identical outputs for shared seeds. Given the existing stack is Python, recommend: **engine in TypeScript (client) + Python mirror (server) + 500 golden seed tests in CI.** It's the least clever option and the hardest to break silently.

---

## 9. Frontend Spec

**Pages:** `/arcade` hub (competition grid with target-record branding: "38-0", "8-0", "82-0"…), `/arcade/{slug}` game, `/arcade/{slug}/leaderboard`.

**Component inventory:**
- `SpinMachine` — one component, two skins: wheel (soccer) and slot machine (US sports). The spin moment is the dopamine hit; invest in the animation (anticipation, decel curve, near-miss ticks, haptics on mobile).
- Board components per sport: `PitchBoard` (formation pitch, vertical on mobile), `CourtBoard`, `GridironBoard`, `RinkBoard`, `DiamondBoard`. All implement one `RosterBoard` interface (slots, fills, tap-to-place).
- `DraftSheet` — bottom sheet listing the dealt cell's players as cards (name, positions, era, OVR + stats in Classic; redacted in Expert).
- `ResultReveal` — game-by-game ticker or table animation; the "L" moment should hurt (screen shake, record freeze).
- `ShareCard` — canvas-rendered PNG (1080×1920 story + 1200×630 OG): record, tier, XI on the board, DraftDogs wordmark. Plus Wordle-style emoji text share (`🟩×17` …). **No club crests, no league logos, no player photos** — typography, era badges, and entity color pairs only.
- `Leaderboard` — global + daily tabs, around-me row.

**Design direction:** mobile-first (this genre spreads through group chats). Follow the frontend-design skill: commit to one bold direction per surface rather than generic gradients — a retro broadcast-graphics / teletext-scoreboard aesthetic is a natural fit for "across the eras" content and works across all five sports. Distinct accent palette per sport, one shared layout system. Player likenesses are out of scope, so lean entirely on typography and color as the visual identity.

---

## 10. Leaderboard Integrity (proportionate, not paranoid)

Threat model for a free game: devtools score forgery (defeated by server-side sim replay at submit), tampered or replayed runs (defeated by the HMAC signature and the unique-nonce constraint — each run submits once), brute-force restarts to fish good spins (acceptable in random modes — it's "playing a lot"; Daily mode is capped at one submitted run per IP per day), profanity in usernames (wordlist filter), spam (IP rate limits on submit). Stop there. No accounts, no captchas, no fingerprinting — disproportionate for the stakes.

---

## 11. Legal / IP Guardrails

Plain-language framing (not legal advice): the thing Krish called "copyright" decomposes into four different risks —

1. **Game mechanics: no risk.** Mechanics/rules are not copyrightable, and four independent clones already operate publicly. Clone the *mechanics* freely.
2. **Expression: real risk, fully avoidable.** Do not copy 38-0/82-0's text, UI, art, code, CSS, name ("38-0", "82-0" as brands), or How-to-Play wording. Everything we ship is written/designed fresh. The games are named by DraftDogs ("DraftDogs Arcade: 38-0 Challenge" is too close — prefer e.g. "Perfect Season: Premier League").
3. **Trademarks: the main live risk.** League names and club names are trademarks. Mitigation pattern proven by 82-0.com: use names **nominatively** (plain text, to refer to the real thing), never use **logos/crests/kits/league marks**, never imply affiliation, and carry a persistent disclaimer per competition: "DraftDogs is an independent project, not affiliated with, endorsed by, or sponsored by [the Premier League / FIFA / the NBA / …]." Non-monetized status further weakens any dilution/endorsement theory, but the disclaimer + no-logos rule is the real protection.
4. **Data provenance:** stats and historical facts are not copyrightable (US). **Do not ship EA's FIFA/Madden rating numbers** — that's EA's curated dataset and the one data shortcut to refuse; DD-OVR derived from open stats + own curation is both safer and more on-brand for an analytics company. Lahman (CC BY-SA — attribute it), nflverse (open), MoneyPuck (cite per their terms), StatsBomb open data (attribution required), Wikipedia facts (fine; don't copy prose). No player photos anywhere (publicity rights + photo copyright).

---

## 12. What We Deliberately Do Differently

For the record, the places this plan diverges from straight cloning, and why:
- **Unified OVR instead of 82-0's raw-stat summation** — required for NFL/NHL/MLB to exist at all; preserves the spirit via the balance penalty.
- **Server-side simulation** — every clone we found appears to be client-trusting; their leaderboards are decorative. Ours can be real, and DraftDogs already pays for the server.
- **Daily seeded mode** — none of the clones have a Wordle loop. Highest-leverage retention feature in the genre.
- **Multi-sport breadth** — the moat. One engine, 14 configs.
- **No ads, ever** (per Krish) — also conveniently the strongest position for risk item 3.

---

## 13. Build Plan — Parallel Workstreams (locked: all competitions at once)

Phases are dissolved into four concurrent workstreams. The "all at the same time" decision works because engineering is one engine + 14 configs, and pools are pipeline output — the only serial resource is human review of pool quality, which gets an explicit priority queue.

- **Workstream A — Core (blocking everything):** TS engine + Python mirror + golden tests, stateless signed-state backend, frontend shell (hub, SpinMachine, boards, DraftSheet, ResultReveal, ShareCard, leaderboard), all four modes including Daily.
- **Workstream B — Soccer pools:** WC → EPL → LaLiga/Serie A/Bundesliga/Ligue 1 → MLS → reuse-derived UCL/Euros/Copa → Mixed Bag union. All runnable in parallel via `pool_builder`; the arrow is the **human-review priority order only**.
- **Workstream C — US-sport pools:** NBA → NFL → MLB → NHL (same caveat: parallel build, prioritized review). NBA/NFL also carry their board UIs (CourtBoard, GridironBoard) as the only competition-specific frontend work.
- **Workstream D — Calibration & QA:** `calibrate.py` invariant runs per pool in CI; 50-player human spot checks per competition; balance sign-off.

**Launch gating:** every competition is behind a config flag and flips on when it passes its gate (validator clean + calibration invariant + spot check). Whether to enable publicly on a rolling basis or hold for one "14 competitions live" moment is a marketing call, not a technical one — the flags support both. The one calendar fact that should override aesthetics: **the World Cup runs June 11 – July 19, 2026.** If only one pool can be review-complete this week, it must be `worldcup`.

**Deliberately deferred (the old "Phase 4" remnants):** chemistry bonuses stay behind a flag — not for effort reasons, but because enabling them changes scoring balance, which forces a `sim_version` bump and fresh leaderboards; treat it as a future "Season 2" balance patch. The cricket/IPL "14-0" idea (DraftDogs already runs Cricsheet workers) remains parked, not planned.

---

## 14. Claude Code Task Breakdown

Tasks 1–6 are sequential core (Workstream A); tasks 7–8 fan out in parallel.

1. **`engine/` (TypeScript, pure):** types, PRNG, spin dealer, draft state machine, fit/rating math, season sim, tournament sim. *Gate:* 100% deterministic across 500 seeds; unit tests for fit multipliers, balance penalty, decades rule, reroll budgets.
2. **`engine_py/` mirror + golden tests.** *Gate:* identical results to TS for all 500 golden seeds, asserted in CI.
3. **`scripts/calibrate.py`.** *Gate:* §5.2 invariant report generated for any pool; wired into CI.
4. **`pool_builder/`** with `worldcup` as the pilot. *Gate:* validator passes; every landable cell ≥8 players; spot-check report of 50 random players for human review.
5. **FastAPI `arcade` router — stateless signed-state protocol (§8)** + `submitted_runs` table + rate limiting + Daily seed derivation. *Gate:* full game playable via curl with nothing but the blob; tampered blobs rejected; double-submit of one nonce rejected; replayed sim at submit matches client result for golden seeds.
6. **Frontend:** hub, game page (SpinMachine, boards, DraftSheet, ResultReveal), mode-choice screen (all four modes incl. Daily), leaderboard, ShareCard. *Gate:* full WC run on a 375px viewport; share PNG renders correctly; Lighthouse perf ≥85 on the arcade route; offline client-side play works with leaderboard submit disabled.
7. **All soccer pools + EPL league-table renderer** (Workstream B, parallel). *Gate per competition:* config + pool only — zero engine-code edits (config purity test).
8. **All US-sport pools + CourtBoard/GridironBoard/DiamondBoard/RinkBoard** (Workstream C, parallel). *Gate:* same config-purity rule; board components conform to the shared `RosterBoard` interface.

## 15. Decision Log (locked June 6, 2026)

1. **Naming:** Draft Dogs brand throughout — *Draft Dogs Arcade* hub, `Draft Dogs {RECORD}: {Competition}` per game, universal **TOP DOG** perfection tier (§0.1).
2. **Sequencing:** all competitions built in parallel behind launch-gate flags; review priority WC → EPL → NBA/NFL → rest (§13).
3. **Formats:** real season/tournament lengths respected (34-0 Bundesliga/Ligue 1/MLS, 15-0 UCL, 8-0 WC, etc.), branded under Draft Dogs.
4. **NFL:** 8-slot typed roster (§4.3).
5. **Modes:** all four ship at launch; explicit mode-choice screen, Classic preselected, no silent Expert default (§2).
6. **Daily mode:** in the launch build, not deferred.
7. **Backend:** stateless HMAC signed-state protocol; one DB write per finished run; pools on CDN (§8). Rethought after cost review — sim compute is microseconds; statefulness was the only real cost and it's gone.

**Still open (small):** public launch style — rolling enablement vs. one "everything live" moment (flags support both); chemistry "Season 2" patch is parked behind a flag.
