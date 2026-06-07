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

## Custom domain (e.g. draftdogs.app)

The repo ships with `public/CNAME` containing the apex domain. The deploy workflow detects this file and rebuilds with `VITE_BASE_PATH=/` automatically — no variable override needed.

Set these records at your registrar:

| Record | Host | Value |
|---|---|---|
| A | `@` (apex) | `185.199.108.153` |
| A | `@` (apex) | `185.199.109.153` |
| A | `@` (apex) | `185.199.110.153` |
| A | `@` (apex) | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<your-user>.github.io.` |

After DNS propagates (5 min – 24 h):

1. Repo Settings → Pages → "Custom domain" → enter `draftdogs.app` → Save. GitHub verifies the DNS, then provisions a Let's Encrypt cert (usually within minutes).
2. Once the cert is ready, tick **"Enforce HTTPS"**. (`.app` is HSTS-preloaded so HTTPS is mandatory — the site won't load over plain HTTP regardless.)
3. Visit `https://draftdogs.app` and `https://www.draftdogs.app` — both should serve the app, with the `www` variant 301-redirecting to apex.

Update the Railway backend:

```
DD_ALLOWED_ORIGINS=https://draftdogs.app,https://www.draftdogs.app
```

(Comma-separated. The localhost dev origins stay live for local testing.)

To switch back to a Pages subpath later, delete `public/CNAME` and the workflow will fall back to `/<repo-name>/`.

## Troubleshooting

- **404 on direct route deep-links** (e.g. `/arcade/epl`) — confirm `dist/404.html` exists; postbuild script should have made it.
- **CORS rejected** — `DD_ALLOWED_ORIGINS` must exactly match the origin in the browser (scheme + host, no path or trailing slash). Includes the `.github.io` subdomain.
- **Leaderboard wiped after redeploy** — Volume not mounted, or `DD_DB_PATH` doesn't point inside the mount.
- **Assets 404** on Pages — `VITE_BASE_PATH` not set or missing trailing slash; rebuild with the correct value.
- **Cold-start latency** on Railway free tier — pay $5/mo for always-on, or move backend to Fly.io / Render which don't sleep.
