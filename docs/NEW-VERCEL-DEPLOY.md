# AgencyPulse: moving to a new Vercel account

Hand this file to the session that has the **new** Vercel account connected.

Repo: `rohabansaari/agency-pulse`, branch `main`. The latest commit is `b8329ef`, which includes desktop agent 1.3.0 with the tray icon.

## Project settings

- **Framework preset:** Services. `vercel.json` at the repo root defines two services:
  - `web`: Next.js in `frontend/`
  - `api`: Laravel container from `backend/Dockerfile.vercel`
- **Root directory:** leave empty (the repo root).
- **Routing:** `/api/*` goes to the Laravel service; everything else goes to Next.js. The site and the API share one domain.
- **Cron:** `vercel.json` runs `/api/v1/cron/daily` every day at 03:00 UTC. Hobby plans allow daily crons only.
- **Environments:** set every variable below for **Production** and **Preview** unless a row says otherwise.

## Environment variables

`🔒` marks a secret. Add it as a **Sensitive** variable and copy its value from your records or from the old project. Never paste secrets into chat.
`NEW-URL` means the new deployment's address, for example `https://agency-pulse-xxxx.vercel.app` (or your own domain later). It has no trailing slash.

### App

| Name | Value | Notes |
| --- | --- | --- |
| `APP_KEY` 🔒 | **The same value as the old project** | Must match exactly. A new key breaks existing logins and anything encrypted. It looks like `base64:…`. |
| `APP_URL` | `NEW-URL` | |
| `FRONTEND_URL` | `NEW-URL` | Also allowed through CORS automatically. |
| `APP_TIMEZONE` | `Asia/Karachi` | Day boundaries for today, reports and payroll. |
| `CRON_SECRET` 🔒 | Any long random string (a new one is fine) | Vercel Cron sends it to `/api/v1/cron/daily`. |

`APP_ENV=production`, `APP_DEBUG=false`, `DB_CONNECTION=pgsql`, `SESSION_DRIVER=cookie`, `CACHE_STORE=database` and `QUEUE_CONNECTION=sync` are already set in `backend/Dockerfile.vercel`. Don't add them.

### Database (Neon Postgres)

Use the **same Neon database** as before, so existing users, time entries and payroll carry over.

| Name | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` 🔒 | Neon **pooled** connection string | `postgresql://…-pooler….neon.tech/…?sslmode=require` |
| `DATABASE_URL_UNPOOLED` 🔒 | Neon **direct** (non-pooled) connection string | Laravel uses this one first. |

These two are all the app reads. The old project also had `POSTGRES_*`, `PG*`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL`. The Neon integration added those automatically and the app doesn't use them, so skip them unless you connect Neon through the Vercel Marketplace on the new account.

**If you create a new Neon database instead,** it starts empty: no organizations, users or history. The super admin below is created on first deploy, and everything else must be set up again.

### Super admin

| Name | Value | Notes |
| --- | --- | --- |
| `SUPER_ADMIN_EMAIL` | `superadmin@agencypulse.com` | |
| `SUPER_ADMIN_PASSWORD` 🔒 | The super admin password | Use a new strong one if the old one was ever shared. |
| `SUPER_ADMIN_RESET` | `false` | **Production only.** Set it to `true` only for a one-time password reset, then back to `false`. |

### Screenshots (Cloudflare R2)

| Name | Value | Notes |
| --- | --- | --- |
| `SCREENSHOT_DISK` | `s3` | |
| `AWS_BUCKET` | `agencypulse-screenshots` | |
| `AWS_ENDPOINT` | `https://34e1b34b939c9ea560f0553ab8ef1518.r2.cloudflarestorage.com` | |
| `AWS_DEFAULT_REGION` | `auto` | |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` | |
| `AWS_ACCESS_KEY_ID` 🔒 | R2 access key ID | |
| `AWS_SECRET_ACCESS_KEY` 🔒 | R2 secret access key | |
| `R2_ACCESS_KEY_ID` 🔒 | The same R2 access key ID | The old project had both names; set both to be safe. |
| `R2_SECRET_ACCESS_KEY` 🔒 | The same R2 secret access key | |
| `R2_REGION` | `auto` | |

### Email (Brevo)

| Name | Value | Notes |
| --- | --- | --- |
| `MAIL_MAILER` | `brevo` | |
| `BREVO_API_KEY` 🔒 | Brevo API key | |
| `MAIL_FROM_ADDRESS` | `agencypulse.notifications@gmail.com` | Change it once you have a domain email. |
| `MAIL_FROM_NAME` | `AgencyPulse` | |

### Optional (defaults are fine)

| Name | Default | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | Don't set it. The site calls the API on the same domain. |
| `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` | `/downloads/AgencyPulseAgent.zip` | Don't set it unless the zip is hosted elsewhere. |
| `TIMER_AGENT_OFFLINE_MINUTES` | `5` | Minutes without the agent checking in before a running timer is auto-paused. |

## After the first deploy

1. **Check the site.** Open `NEW-URL`, sign in as super admin, then as an employee. Start and stop the timer.
2. **Check uploads.** Open the screenshot gallery and confirm older screenshots load, which proves R2 works.
3. **Check email.** Invite a test employee and confirm the invitation email arrives.
4. **Update the desktop agent.** It's built with the old address (`https://agency-pulse-six.vercel.app/api/v1`). That project is paused, so:
   - Change `DEFAULT_API_BASE_URL` in `desktop-agent/agent.py` to `NEW-URL/api/v1`.
   - Add the old address to `LEGACY_API_BASE_URLS`, so installed agents move their saved setting automatically.
   - Bump `AGENT_VERSION` and `version_info.txt` to 1.3.1.
   - Push to a branch. The desktop-agent workflow rebuilds `frontend/public/downloads/AgencyPulseAgent.zip`. Merge, then redeploy.
   - Every employee downloads the agent once from the new site. Version 1.3.0 and later replace the old one automatically.
5. **Avoid the old storage problem.** The old account broke because every preview deploy pushed a new `api` container image until the registry hit its limit. On the new account:
   - Limit preview deploys, for example with an Ignored Build Step that skips non-`main` branches, or turn off preview deployments for `claude/*` branches.
   - Periodically delete old images in Sandboxes → Container Registry → `api`.
6. **Use a custom domain eventually** (for example `agencypulse.pk`). Then a future move won't change the address, and the agent never needs re-pointing again.
