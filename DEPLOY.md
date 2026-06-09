# Deploy AgencyPulse on Render (Free Tier)

**GitHub repo:** https://github.com/Rohabansari/agency-pulse

Use **manual Web Services** on the **Free** plan. Do **not** use Blueprint (`render.yaml`) — Blueprint requires a paid Render plan.

You need **2 free Render web services** + **1 free MySQL database on Railway** (Render does not offer MySQL).

| What | Where | Cost |
|------|--------|------|
| MySQL database | **Railway** | Free tier |
| Laravel API | **Render** Web Service (Docker, Free) | $0 |
| Next.js frontend | **Render** Web Service (Node, Free) | $0 |

Free tier note: services **sleep after ~15 min idle**. First visit after sleep may take 30–60 seconds.

---

## Part 1 — Create MySQL on Railway (SQL database)

1. Go to **https://railway.app** → sign in with GitHub.
2. Click **New Project** → **Provision MySQL**.
3. Click the **MySQL** tile → **Variables** tab.
4. Copy these values:

| Railway variable | You will paste as |
|------------------|-------------------|
| `MYSQLHOST` | `DB_HOST` |
| `MYSQLPORT` | `DB_PORT` (usually `3306`) |
| `MYSQLDATABASE` | `DB_DATABASE` |
| `MYSQLUSER` | `DB_USERNAME` |
| `MYSQLPASSWORD` | `DB_PASSWORD` |

5. Open **Settings** → **Networking** → enable **Public Networking** (required so Render can connect).

Keep this tab open.

---

## Part 2 — Deploy the API on Render (Free)

1. Go to **https://dashboard.render.com** → **New +** → **Web Service**.
2. Connect GitHub → select **Rohabansari / agency-pulse**.
3. Configure:

| Field | Value |
|-------|--------|
| **Name** | `agencypulse-api` |
| **Region** | Oregon (or closest to you) |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | **Docker** |
| **Dockerfile Path** | `docker/render/Dockerfile.api` |
| **Instance Type** | **Free** |

4. **Environment Variables** — click **Add Environment Variable** for each:

| Key | Value |
|-----|--------|
| `APP_NAME` | `AgencyPulse` |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `LOG_CHANNEL` | `stderr` |
| `DB_CONNECTION` | `mysql` |
| `DB_HOST` | *paste `MYSQLHOST` from Railway* |
| `DB_PORT` | `3306` |
| `DB_DATABASE` | *paste `MYSQLDATABASE`* |
| `DB_USERNAME` | *paste `MYSQLUSER`* |
| `DB_PASSWORD` | *paste `MYSQLPASSWORD`* |
| `CACHE_STORE` | `database` |
| `SESSION_DRIVER` | `database` |
| `QUEUE_CONNECTION` | `database` |

`APP_KEY` is auto-generated on first deploy if missing (or add one from `php artisan key:generate --show` locally).

5. Click **Deploy Web Service**.
6. Wait until status is **Live** (first build ~5–10 min).
7. Copy your API URL, e.g. `https://agencypulse-api.onrender.com`.
8. Test: open `https://agencypulse-api.onrender.com/api/v1/health` — you should see JSON.

9. Go back to **Environment** and add (use your real URLs):

| Key | Value |
|-----|--------|
| `APP_URL` | `https://agencypulse-api.onrender.com` |
| `FRONTEND_URL` | `https://agencypulse-web.onrender.com` *(add after Part 3, or your frontend URL)* |

Save to redeploy.

---

## Part 3 — Deploy the Frontend on Render (Free)

1. **New +** → **Web Service** → same repo **agency-pulse**.
2. Configure:

| Field | Value |
|-------|--------|
| **Name** | `agencypulse-web` |
| **Region** | Same as API |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Runtime** | **Node** |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

3. **Environment Variables**:

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `22` |
| `NEXT_PUBLIC_API_URL` | `https://agencypulse-api.onrender.com/api/v1` |

Replace with **your** API URL from Part 2, including `/api/v1`.

4. Click **Deploy Web Service**.
5. When **Live**, open `https://agencypulse-web.onrender.com`.
6. **Register** your admin account.

7. Update API service `FRONTEND_URL` to your frontend URL if you used a placeholder in Part 2.

---

## Part 4 — Verify

| Check | URL |
|-------|-----|
| API health | `https://agencypulse-api.onrender.com/api/v1/health` |
| Login / Dashboard | `https://agencypulse-web.onrender.com/dashboard` |
| Payroll | `https://agencypulse-web.onrender.com/admin/payroll` |

Use the **frontend** URL for the app — not the API URL.

---

## Free tier limits

| Limit | What it means |
|-------|----------------|
| Spins down when idle | First load after idle is slow |
| 750 hours/month per service | Enough for one API + one frontend |
| No background workers | Queues use `database` driver (fine for MVP) |
| Railway MySQL | Free credits / usage limits — check Railway dashboard |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API build fails | Open **Logs** on Render; ensure Dockerfile path is `docker/render/Dockerfile.api` |
| Database connection error | Railway **Public Networking** on; double-check `DB_*` values |
| Frontend API errors | `NEXT_PUBLIC_API_URL` must be `https://YOUR-API.onrender.com/api/v1` then **Manual Deploy** frontend |
| Payroll 404 | Open frontend URL, not API URL |
| 502 on API | Check logs; migrations may fail if `DB_*` wrong |

---

## Optional: Blueprint (paid Render plan only)

The file `render.yaml` in the repo is for **paid** Render Blueprint deploys. Ignore it on the free plan.

---

## Local development

```bash
docker compose up -d --build
docker compose exec app php artisan migrate
```

App: http://localhost:8080
