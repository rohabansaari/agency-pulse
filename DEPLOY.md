# Deploy AgencyPulse on Render (Free Tier)

> **Legacy.** Production is moving to Vercel + Neon. See [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

**GitHub repo:** https://github.com/Rohabansari/agency-pulse

Use **manual Web Services** on the **Free** plan. Do **not** use Blueprint (`render.yaml`) — Blueprint requires a paid Render plan.

You need **2 free Render web services** + **1 Supabase PostgreSQL database** (Render does not offer managed Postgres on free tier).

| What | Where | Cost |
|------|--------|------|
| PostgreSQL database | **Supabase** | Free tier |
| Laravel API | **Render** Web Service (Docker, Free) | $0 |
| Next.js frontend | **Render** Web Service (Node, Free) | $0 |

Free tier note: services **sleep after ~15 min idle**. First visit after sleep may take 30–60 seconds.

---

## Part 1 — Create PostgreSQL on Supabase

1. Go to **https://supabase.com** → sign in → **New project**.
2. Choose a name (e.g. `agencypulse`), set a **strong database password**, pick a region close to your Render API (e.g. US West).
3. Wait until the project finishes provisioning (~2 minutes).
4. Open **Project Settings** → **Database**.
5. Under **Connection string** → **URI**, copy the values (or use the **Session pooler** / **Direct** host — both work with Laravel; **Direct** is fine for Render).

| Render variable | Supabase source |
|-----------------|-----------------|
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | Host from connection string (e.g. `db.xxxxx.supabase.co`) |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | `postgres` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | Your project database password |
| `DB_SCHEMA` | `public` |
| `DB_SSLMODE` | `require` |

**SSL is required** for Supabase. Always set `DB_SSLMODE=require` on Render.

Keep this tab open. If you are migrating from Railway MySQL, see **[docs/database-migration-railway-to-supabase.md](docs/database-migration-railway-to-supabase.md)**.

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
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | Supabase host (e.g. `db.xxxxx.supabase.co`) |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | `postgres` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | Your Supabase database password |
| `DB_SCHEMA` | `public` |
| `DB_SSLMODE` | `require` |

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
| `FRONTEND_URL` | `https://agencypulse-web.onrender.com` *(your frontend URL — also enables CORS and invitation links)* |
| `CORS_ALLOWED_ORIGINS` | *(optional)* extra origins, comma-separated, if you use a custom domain |

Save to redeploy, then configure **email** using one of the options below.

### Email on Render (read this — SMTP timeouts are expected on free tier)

**Render free web services block outbound SMTP** on ports **25, 465, and 587**. Gmail App Passwords can be correct and you will still see:

`Unable to connect to ssl://smtp.gmail.com:465 (Operation timed out)`

This is **not** a wrong password — it is Render's network policy ([changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)).

Pick **one** path (all use HTTPS on port 443 — works on Render free tier):

| Provider | Custom domain? | Free volume | Daily cap | Unique recipients | Credit card | Best for |
|----------|----------------|-------------|-----------|-------------------|-------------|----------|
| **Piisend** *(recommended without a domain)* | **No** — shared sender | 3,000/month | 100/day | No cap | No | Invitation emails before you own a domain |
| Resend | Yes — DNS verification | 3,000/month | 100/day | No cap on verified domain | No | Branded sender once you have a domain |
| Brevo | Yes — DNS verification | ~9,000/month | 300/day | No cap on verified domain | No | Higher daily volume with your domain |
| MailerSend | Yes (trial `@mlsender.net` = **2 recipients only**) | 3,000/month | — | 2 on trial sender | No | Legacy — verified domain only |

#### Option A — Piisend (no custom domain required)

Use this when you **do not own a domain yet**. Piisend sends from a **shared platform address** on the free tier — no DNS setup.

1. Sign up at [piisend.com](https://piisend.com) — no credit card.
2. **API → Keys** → create a key with scope **`emails:send`** (`pii_live_…` or `pii_test_…`).
3. On Render **API** service → **Environment**:

| Key | Value |
|-----|--------|
| `MAIL_MAILER` | `piisend` |
| `PIISEND_API_KEY` | `pii_live_…` *(your Piisend API key)* |
| `MAIL_FROM_NAME` | `AgencyPulse` |

`MAIL_FROM_ADDRESS` is **optional** on Piisend free tier — leave it unset and Piisend uses the shared sender. Set it later when you verify your own domain in Piisend.

Remove Gmail SMTP variables and any unused Resend/Brevo/MailerSend keys.

4. Save → redeploy → **Platform** → **Send test email**.

Later, when you buy a domain: verify it in Piisend → set `MAIL_FROM_ADDRESS` to e.g. `noreply@yourdomain.com` → redeploy.

#### Option B — Resend (requires your own domain)

1. Sign up at [resend.com](https://resend.com) — no credit card.
2. **Domains** → add and verify your domain (DNS: SPF, DKIM).
3. **API Keys** → create a key (`re_…`).
4. On Render **API** service → **Environment**:

| Key | Value |
|-----|--------|
| `MAIL_MAILER` | `resend` |
| `RESEND_KEY` | `re_…` *(your Resend API key)* |
| `MAIL_FROM_ADDRESS` | `noreply@yourdomain.com` *(verified domain)* |
| `MAIL_FROM_NAME` | `AgencyPulse` |

Remove Gmail SMTP variables and any unused MailerSend/Brevo keys.

5. Save → redeploy → **Platform** → **Send test email**.

You cannot send `from` `@gmail.com` — the From address must use your verified domain.

#### Option C — Brevo (300 emails/day, works on Render free tier)

Uses HTTPS (port 443). Free plan: **300 emails/day** (~9,000/month).

**Important:** AgencyPulse uses Brevo’s **HTTP API**, not SMTP. You need an **API key** (`xkeysib-…`), **not** an SMTP key (`xsmtpsib-…`). Render free tier blocks SMTP anyway.

##### Step 1 — Verify your Gmail sender in Brevo

1. Log in at [app.brevo.com](https://app.brevo.com).
2. **Senders, Domains & IPs** → **Senders** → **Add a sender**.
3. From name: `AgencyPulse`
4. From email: `agencypulse.notifications@gmail.com`
5. Brevo emails a **6-digit code** to that inbox — enter it in Brevo → **Verify sender**.

(Gmail cannot be domain-authenticated; single-sender verification is enough to start sending.)

##### Step 2 — Create an HTTP API key (not SMTP key)

1. Profile menu → **SMTP & API** → **API keys** tab *(not SMTP keys)*.
2. **Generate a new API key** → name it e.g. `AgencyPulse Render`.
3. Copy the key — it starts with **`xkeysib-`**.

Do **not** paste `xsmtpsib-…` keys into `BREVO_API_KEY` — those are for SMTP only.

##### Step 3 — Render API environment variables

On your **`agencypulse-api`** service → **Environment**:

| Key | Value |
|-----|--------|
| `MAIL_MAILER` | `brevo` |
| `BREVO_API_KEY` | `xkeysib-…` *(HTTP API key from Step 2)* |
| `MAIL_FROM_ADDRESS` | `agencypulse.notifications@gmail.com` |
| `MAIL_FROM_NAME` | `AgencyPulse` |

Remove unused mail keys: `PIISEND_API_KEY`, `RESEND_KEY`, `MAILERSEND_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`, Gmail SMTP vars.

##### Step 4 — Deploy and test

1. Save → wait for redeploy (**Live**).
2. **Platform** → **Send test email**.
3. Invite an employee — check inbox and spam.

If Brevo returns “sender not valid”, the Gmail address is not verified yet — repeat Step 1.

#### Option D — MailerSend (legacy, requires domain)

Uses HTTPS (port 443). Free tier: 3,000 emails/month.

1. Sign up at [mailersend.com](https://www.mailersend.com) → **Email** → **Domains** → add and verify your domain (DNS records).
2. **Email** → **Domains** → your domain → **API tokens** → create a token (`mlsn.…`).
3. On Render **API** service → **Environment**:

| Key | Value |
|-----|--------|
| `MAIL_MAILER` | `mailersend` |
| `MAILERSEND_API_KEY` | `mlsn.…` *(your MailerSend API token)* |
| `MAIL_FROM_ADDRESS` | `noreply@yourdomain.com` *(must be on your verified MailerSend domain)* |
| `MAIL_FROM_NAME` | `AgencyPulse` |

Remove Gmail SMTP variables (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`) — they will not work on Render free tier anyway.

4. Save → wait for redeploy → **Platform** → **Send test email**.

You cannot send `from` `@gmail.com` via MailerSend — the From address must use your verified domain.

**Trial sender domain limit:** If `MAIL_FROM_ADDRESS` uses MailerSend's trial domain (`@*.mlsender.net`), MailerSend only allows **2 unique recipients** total — admin invites to your signup email may work while employee, manager, and sub-admin invites to other inboxes fail with `MS42225`. This is separate from your monthly email quota. Fix: verify your own domain in MailerSend → set `MAIL_FROM_ADDRESS` to e.g. `noreply@yourdomain.com` (not `@mlsender.net`) → redeploy → resend invitations from **Employees**.

#### Option E — Gmail SMTP (Render **Starter+** API only)

Render **free** web services block outbound SMTP on ports **587** and **465**. Upgrade the API web service from **Free** to **Starter** ($7/mo) to use Gmail.

1. In Google Account → **Security** → enable **2-Step Verification**.
2. **App passwords** → create one for “Mail” → copy the 16-character password (no spaces).
3. On Render **API** service → **Environment**:

| Key | Value |
|-----|--------|
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` | `smtp.gmail.com` |
| `MAIL_PORT` | `587` |
| `MAIL_ENCRYPTION` | `tls` |
| `EMAIL_USER` | `agencypulse.notifications@gmail.com` |
| `EMAIL_PASS` | *(Gmail App Password — 16 chars, no spaces)* |
| `MAIL_FROM_ADDRESS` | `agencypulse.notifications@gmail.com` |
| `MAIL_FROM_NAME` | `AgencyPulse` |

`EMAIL_USER` / `EMAIL_PASS` are aliases for `MAIL_USERNAME` / `MAIL_PASSWORD`. Never commit the app password to GitHub.

4. Save → redeploy → **Platform** → **Send test email** → invite a team member.

**After any mail change:** Save on Render → redeploy → **Platform** → **Send test email** → check inbox and spam.

### Invitation email flow

- Super-admin creates an organization → admin receives a **Set password** email.
- Org admin invites employees → each person receives an invitation email.
- Links open `{FRONTEND_URL}/set-password?token=…` and expire after **24 hours**.
- No passwords are ever sent by email.

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
6. Open the app and sign in as super-admin, or use an invitation link from email after creating an org.

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

Share `dist\AgencyPulseAgent.zip` with employees and managers (place in `frontend/public/downloads/` or host on CDN). Each employee extracts `AgencyPulseAgent.exe` from the zip and double-clicks it.

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
| Supabase Postgres | Free tier project limits — check Supabase dashboard |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API build fails | Open **Logs** on Render; ensure Dockerfile path is `docker/render/Dockerfile.api` |
| `SQLSTATE[08006] Connection refused` / SSL errors | Set `DB_SSLMODE=require`; confirm Supabase host and password |
| `password authentication failed` | Re-copy password from Supabase → Settings → Database |
| Database connection error | Confirm `DB_CONNECTION=pgsql`, port `5432`, and project is not paused in Supabase |
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
