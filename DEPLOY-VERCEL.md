# Deploy AgencyPulse on Vercel (+ Neon Postgres)

One Vercel project runs both apps as **services** (see [`vercel.json`](vercel.json)):

| Path | Service | Source |
|------|---------|--------|
| `/api/*` | `api` — Laravel 12 in a container (FrankenPHP) | `backend/Dockerfile.vercel` |
| everything else | `web` — Next.js | `frontend/` |

Frontend and API share one domain, so there is no CORS setup and the frontend calls `/api/v1` directly.

| Concern | On Vercel |
|---------|-----------|
| Database | **Neon** Postgres from the Vercel Marketplace (`DATABASE_URL` is injected automatically) |
| Scheduler | **Vercel Cron** → `GET /api/v1/cron/daily` (idempotency + screenshot retention purge) |
| Queue | `sync` — invitation mail is sent inline |
| Cache | `database` (no Redis needed) |
| Files | Screenshots → private S3/R2 bucket; logos → public R2 bucket. The container disk is ephemeral. |
| Logs | stderr → Vercel runtime logs |
| Migrations | Run when a container boots (`backend/vercel/start.sh`); a no-op costs one query |

> **Plan:** Vercel Hobby is for non-commercial use. A SaaS in production needs **Pro**.

---

## 1. Create the project

1. Vercel → **Add New → Project** → import `rohabansaari/agency-pulse`.
2. Leave **Root Directory** at the repository root. `vercel.json` defines both services.
3. Don't deploy yet. Add the database and env vars first.

## 2. Add Neon Postgres

1. Project → **Storage → Create Database → Neon** (or `vercel integration add neon`).
2. Connect it to **Production** and **Preview**.
3. Neon adds `DATABASE_URL` (pooled) and related vars. Laravel reads `DATABASE_URL` automatically.

Optionally enable Neon's preview branching so each preview deployment gets its own database copy.

## 3. Storage for screenshots and logos (Cloudflare R2)

Vercel Blob doesn't offer an S3-compatible API. AgencyPulse uses S3-compatible storage, so create two R2 buckets (free tier: 10 GB):

- `agencypulse-screenshots`: **private**. The API serves signed URLs.
- `agencypulse-public`: **public** (enable the r2.dev URL or attach a custom domain) for organization logos.

Create an R2 API token with read/write access to both buckets.

## 4. Environment variables

Project → **Settings → Environment Variables** (Production and Preview):

| Key | Value |
|-----|-------|
| `APP_KEY` | `base64:...` (run `php artisan key:generate --show` locally) |
| `APP_URL` | `https://<your-domain>` |
| `FRONTEND_URL` | `https://<your-domain>` (used in invitation links) |
| `CRON_SECRET` | Long random string. Vercel Cron sends it automatically. |
| `SUPER_ADMIN_PASSWORD` | ≥ 12 characters. Creates `superadmin@gmail.com` on first boot. |
| `SCREENSHOT_DISK` | `s3` |
| `UPLOADS_DISK` | `s3_public` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | R2 token |
| `AWS_DEFAULT_REGION` | `auto` |
| `AWS_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` |
| `AWS_BUCKET` | `agencypulse-screenshots` |
| `AWS_PUBLIC_BUCKET` | `agencypulse-public` |
| `AWS_PUBLIC_URL` | `https://pub-<id>.r2.dev` (or your custom domain) |
| `MAIL_MAILER` + provider key | e.g. `brevo` + `BREVO_API_KEY`, or `resend` + `RESEND_KEY` (see DEPLOY.md → Email) |
| `MAIL_FROM_ADDRESS` | Verified sender |

Defaults baked into the image (override only if needed): `APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `CACHE_STORE=database`, `QUEUE_CONNECTION=sync`, `SESSION_DRIVER=cookie`.

Set `RUN_MIGRATIONS_ON_BOOT=false` if you'd rather run `php artisan migrate --force` from CI.

## 5. Deploy and verify

1. Deploy (push to the production branch or click **Deploy**).
2. Check:
   - `https://<your-domain>/api/v1/health` → `{"status":"ok", ... "screenshot_s3_configured": true}`
   - `https://<your-domain>/` → login page
3. Sign in as `superadmin@gmail.com` with `SUPER_ADMIN_PASSWORD` and create the first organization.
4. Project → **Settings → Cron Jobs** shows `/api/v1/cron/daily`. Use **Run** to test it.

## 6. Desktop agent

The agent's default API URL is in `desktop-agent/agent.py` (`DEFAULT_API_BASE_URL`) and `config.example.json`.

1. Set both to `https://<your-domain>/api/v1`.
2. Rebuild on Windows (`desktop-agent\build.ps1`) and replace `frontend/public/downloads/AgencyPulseAgent.zip`.
3. Existing installs keep their saved URL. Employees delete `%USERPROFILE%\.agencypulse\agent-config.json` and sign in again.

## 7. Retire Render

Once production on Vercel is verified, delete the Render services. The Render-only files (`render.yaml`, `docker/render/`) can then be removed.

## Limits to know

- **Request body: 4.5 MB.** Agent screenshots (1600px JPEG, q60) are typically a few hundred KB. Logo uploads are capped at 2 MB.
- **Cold starts:** the first request after idle time boots the container (PHP + migration check).
- **Cron on Hobby:** once per day at most, with loose timing. The daily job fits this.
