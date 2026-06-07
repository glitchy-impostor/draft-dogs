# Deploy: GitHub Pages (frontend) + Railway (backend)

## TL;DR

```
backend  →  Railway service (FastAPI, $PORT)  →  https://<your-app>.up.railway.app
frontend →  GitHub Pages (Vite build)         →  https://<user>.github.io/<repo>/
                                                      └─ calls the Railway URL
```

The frontend has no server logic; the backend is stateless except for the
SQLite leaderboard. CORS, HMAC, and the DB path are all env-driven.

## 1. Deploy the backend on Railway

1. Push the repo to GitHub.
2. New Railway project → "Deploy from GitHub repo" → pick this repo.
3. Railway will detect `requirements.txt` + `runtime.txt` + `railway.json`
   and run `pip install -r requirements.txt`, then start with
   `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`.
4. Set these env vars in the Railway service:
   - `DD_ARCADE_HMAC_KEY` — generate with `python -c "import secrets; print(secrets.token_hex(32))"`.
   - `DD_ALLOWED_ORIGINS` — `https://<your-user>.github.io` (comma-separated if you serve from multiple).
   - `DD_DB_PATH` — `/data/leaderboard.db` (matches the mount path below). Omit for an ephemeral in-memory store.
5. Add a **Volume** mounted at `/data` so the SQLite file survives redeploys.
   Railway → service → Settings → Volumes → mount path `/data`.
6. Hit `https://<your-app>.up.railway.app/health` — should return `{"status":"ok"}`.

## 2. Deploy the frontend on GitHub Pages

1. Repo → Settings → Pages → Build and deployment → **GitHub Actions** (not "Deploy from a branch").
2. Repo → Settings → Secrets and variables → Actions → **Variables** tab → add:
   - `VITE_BASE_PATH` — `/<repo-name>/` (e.g. `/draft-dogs-redesign/`). Trailing slash matters.
   - `VITE_API_URL`   — `https://<your-app>.up.railway.app` (no trailing slash).
3. Push to `main`. The `.github/workflows/deploy-pages.yml` workflow will:
   - `npm ci` and `npm run build` with those env vars baked in
   - Run `scripts/postbuild-spa-fallback.mjs` to copy `index.html` → `404.html` and emit `.nojekyll`
   - Upload `dist/` to Pages and publish.
4. Site goes live at `https://<your-user>.github.io/<repo>/`.

## 3. Local development

Unchanged — `npm run dev` (port 5180) + `uvicorn backend.app.main:app --reload --port 8000`. The Vite dev proxy routes `/api/*` to the backend, and `VITE_API_URL` is left blank so requests are same-origin.

## Troubleshooting

- **404 on direct route deep-links** (e.g. `/arcade/epl`) — confirm `dist/404.html` exists; postbuild script should have made it.
- **CORS rejected** — `DD_ALLOWED_ORIGINS` must exactly match the origin in the browser (scheme + host, no path or trailing slash). Includes the `.github.io` subdomain.
- **Leaderboard wiped after redeploy** — Volume not mounted, or `DD_DB_PATH` doesn't point inside the mount.
- **Assets 404** on Pages — `VITE_BASE_PATH` not set or missing trailing slash; rebuild with the correct value.
- **Cold-start latency** on Railway free tier — pay $5/mo for always-on, or move backend to Fly.io / Render which don't sleep.
