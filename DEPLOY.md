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
3. Click the **MySQL** tile → **Settings** → **Networking**.
4. Enable **Public Networking** (TCP proxy). Railway will show a **public hostname** and **port** (e.g. `roundhouse.proxy.rlwy.net` and `12345`).

   **Important:** Do **not** use `mysql.railway.internal` or any `*.railway.internal` host on Render. That hostname only works inside Railway. Render is outside Railway and will fail with `Name does not resolve`.

5. Click the **MySQL** tile → **Variables** (or **Connect**) tab.
6. After public networking is on, use the **public** connection values:

| Render variable | Where to get it on Railway |
|-----------------|---------------------------|
| `DB_HOST` | Public proxy hostname (e.g. `roundhouse.proxy.rlwy.net`) — **not** `mysql.railway.internal` |
| `DB_PORT` | Public proxy port from Networking (often **not** `3306`) |
| `DB_DATABASE` | `MYSQLDATABASE` (usually `railway`) |
| `DB_USERNAME` | `MYSQLUSER` (usually `root`) |
| `DB_PASSWORD` | `MYSQLPASSWORD` |

If `MYSQLHOST` still shows `mysql.railway.internal`, ignore it for Render — use the **public** host + port from **Settings → Networking** instead.

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
| `APP_KEY` | `base64:...` *(required — generate locally: `docker compose exec app php artisan key:generate --show`)* |
| `APP_DEBUG` | `false` |
| `LOG_CHANNEL` | `stderr` |
| `DB_CONNECTION` | `mysql` |
| `DB_HOST` | Copy the **value** of Railway `MYSQLHOST` (e.g. `containers-us-west-123.railway.app`) — not the word `MYSQLHOST` |
| `DB_PORT` | Copy Railway `MYSQLPORT` (usually `3306`) |
| `DB_DATABASE` | Copy Railway `MYSQLDATABASE` value |
| `DB_USERNAME` | Copy Railway `MYSQLUSER` value |
| `DB_PASSWORD` | Copy Railway `MYSQLPASSWORD` value |

Do **not** leave placeholder text like `<paste MYSQLHOST>` — Laravel will try to connect to that literal string and fail.
| `CACHE_STORE` | `database` |
| `SESSION_DRIVER` | `database` |
| `QUEUE_CONNECTION` | `database` |

`APP_KEY` is **required** — the API container will not start without it.

5. Click **Deploy Web Service**.
6. Wait until status is **Live** (first build ~5–10 min).
7. Copy your API URL, e.g. `https://agencypulse-api.onrender.com`.
8. Test: open `https://agencypulse-api.onrender.com/api/v1/health` — you should see JSON.

9. Go back to **Environment** and add (use your real URLs):

| Key | Value |
|-----|--------|
| `APP_URL` | `https://agencypulse-api.onrender.com` |
| `FRONTEND_URL` | `https://agencypulse-web.onrender.com` *(your frontend URL — also enables CORS for signup/login)* |
| `CORS_ALLOWED_ORIGINS` | *(optional)* extra origins, comma-separated, if you use a custom domain |

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
| **Root Directory** | **`frontend`** *(critical — if blank, Render builds the repo root and fails)* |
| **Runtime** | **Node** |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

If you already created the service with the wrong root, open **Settings** → set **Root Directory** to `frontend` → **Save** → **Manual Deploy**.
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

## Part 3b — Screenshots (Desktop Agent + Cloudflare R2)

Screenshots are captured by the **AgencyPulse Desktop Agent** (`desktop-agent/`), not the browser.

1. Employee downloads **AgencyPulseAgent.zip**, extracts it, and double-clicks **AgencyPulseAgent.exe** (first-run setup is automatic — no CLI).
2. Employee signs in once when prompted (credentials saved locally).
3. Employee starts the timer on **Time Tracking** (`/time`) — the web app wakes the agent automatically.
4. Agent captures **full-desktop screenshots every 5 minutes** (first capture immediately).
5. Employees and managers view captures on **Screenshots** (`/screenshots`) — **read-only**.
6. Screenshots older than **60 days** are purged automatically (daily scheduler in the API container).

### Build and distribute the desktop agent

On a Windows machine with Python 3:

```powershell
cd desktop-agent
.\build.ps1
```

Share `dist\AgencyPulseAgent.zip` with employees and managers (place in `frontend/public/downloads/` or host on CDN). Each employee extracts the **AgencyPulseAgent** folder and double-clicks `AgencyPulseAgent.exe` inside it.

**Antivirus note:** The agent is unsigned PyInstaller software that captures screenshots and adds a Startup entry. Windows Defender may flag it as a false positive. Rebuild with `desktop-agent/build.bat` and see `desktop-agent/README.md` for mitigations and optional code signing.

After that, starting the web timer auto-wakes the agent. See `desktop-agent/README.md`.

### API environment (Cloudflare R2 — recommended for production)

Add these on **Render → API service → Environment**:

| Key | Value |
|-----|--------|
| `SCREENSHOT_DISK` | `s3` |
| `SCREENSHOT_RETENTION_DAYS` | `60` |
| `AWS_ACCESS_KEY_ID` | R2 access key ID |
| `AWS_SECRET_ACCESS_KEY` | R2 secret access key |
| `AWS_DEFAULT_REGION` | `auto` |
| `AWS_BUCKET` | Your R2 bucket name |
| `AWS_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` |
| `FRONTEND_URL` | `https://agencypulse-web.onrender.com` |

Create R2 credentials in **Cloudflare Dashboard → R2 → Manage R2 API tokens**. The bucket can be private — the API serves signed image URLs to authorized users only.

For local dev only, you can use `SCREENSHOT_DISK=public` (files on API disk).

Migrations and `storage:link` run automatically on deploy via `docker/render/start-api.sh`.

---

## Part 4 — Verify

| Check | URL |
|-------|-----|
| API health | `https://agencypulse-api.onrender.com/api/v1/health` |
| Login / Dashboard | `https://agencypulse-web.onrender.com/dashboard` |
| Time tracking | `https://agencypulse-web.onrender.com/time` |
| Screenshots gallery | `https://agencypulse-web.onrender.com/screenshots` |
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
| `getaddrinfo for mysql.railway.internal failed` | `DB_HOST` is Railway's **private** host — enable **Public Networking** on Railway and use the **public** proxy hostname + port |
| `getaddrinfo for <paste MYSQLHOST> failed` | `DB_HOST` still has placeholder text — paste the real Railway hostname |
| Database connection error | Railway **Public Networking** on; double-check all `DB_*` **values** from Railway Variables |
| Frontend `Missing script: "build"` + Playwright download in logs | **Root Directory** must be `frontend`, not repo root |
| Signup/login fails with generic error | Set `FRONTEND_URL` on API to your frontend URL, redeploy API; confirm `NEXT_PUBLIC_API_URL` on frontend and redeploy web |
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
