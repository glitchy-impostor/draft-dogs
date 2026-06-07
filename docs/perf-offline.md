# Perf & offline verification (task #26)

## Bundle audit (production `vite build`)

Per-route fresh-load JS gzip sizes:

| Resource             | Size (gzip) | Notes                                  |
|----------------------|-------------|----------------------------------------|
| `vendor-react`       | 53.15 kB    | Cached cross-route after first hit     |
| `index`              |  1.42 kB    | App shell                              |
| `ArcadeHub` (JS+CSS) |  2.32 kB    | Hub-only                               |
| `ArcadeGame` (JS+CSS)| 15.73 kB    | All game UI                            |
| `arcade-engine`      |  5.02 kB    | Pure TS engine                         |
| `registry`           |  8.77 kB    | All competition configs                |
| Per-pool chunks      |  1–13 kB    | Lazy-loaded — only the WC pool loads on the WC route |

Bundle conclusion: a first-visit player landing on `/arcade/worldcup`
downloads roughly:

```
vendor (53k) + index (1.4k) + ArcadeGame (16k) + engine (5k) +
  registry (9k) + worldcup-pool (8.5k) = ~93 kB gzip
```

For a returning player, only the route-specific chunk + pool change
(`vendor-react` cached). Lighthouse target ≥85 is comfortably reachable.

The `manualChunks` rule in `vite.config.ts` was explicitly tuned for this:
- `vendor-react` is grouped (caches well across routes)
- Engine is its own chunk
- Pools are **not** grouped — each competition's pool is a per-route lazy chunk

Pre-fix this looked different: all 15 pools were bundled into one 60 kB
chunk that downloaded on every game route. The fix is the comment in
`vite.config.ts:24-26`.

## Offline / API-down verification

Per §8: "the game must also run fully client-side ... when the API is down
— you just can't submit to the leaderboard."

Verified by stopping the FastAPI backend (`uvicorn` killed) and curling
the frontend routes:

| Route                                    | Status |
|------------------------------------------|--------|
| `GET /arcade`                            | 200    |
| `GET /arcade/worldcup`                   | 200    |
| `GET /arcade/worldcup/leaderboard`       | 200    |
| `GET /api/arcade/competitions` (proxy)   | 500    |

All page routes serve normally. The Vite proxy returns 500 on `/api/*`
because the upstream is down, and the frontend:

- **Game flow**: works fully — configs and pools are imported into the
  bundle, the TS engine runs the sim in the browser
- **Submit panel**: shows "Couldn't reach the leaderboard service (or
  username rejected). Local play still works." (see `GameView.tsx`)
- **Leaderboard page**: shows "No connection to the leaderboard service.
  Local play still works." (see `ArcadeLeaderboard.tsx`)

## What I couldn't verify from CLI

- **Real Lighthouse run**: needs a headless Chrome / `npm i -g
  lighthouse` invocation. Bundle audit + code-side checks above are a
  proxy. Run `lighthouse http://localhost:5180/arcade --view` in the
  browser to confirm score.
- **375 px mobile viewport**: needs a real browser to verify layout.
  CSS uses `clamp()` + `dvh` + `aspect-ratio` so it should be fine, but
  worth a manual pass.

## Run yourself

```sh
npm run build              # bundle audit
npm run dev                # Vite at :5180
# kill backend, confirm /arcade and /arcade/<slug> still load
lighthouse http://localhost:5180/arcade --view   # real perf score
```
