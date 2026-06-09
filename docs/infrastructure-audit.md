# Infrastructure Audit — Story 1.1

**Date:** 2026-06-08  
**Scope:** Docker stack validation only (no business logic)

---

## 1. Missing Components (before Story 3.1)

| Component | Status | Action |
|-----------|--------|--------|
| **Laravel app skeleton** | ❌ CRITICAL | `backend/app/`, `config/`, `database/`, `storage/` missing — containers cannot serve API until Story 1.1 backend bootstrap completes |
| **composer.lock** | ⚠️ | Generated on first `composer install` inside container |
| **backend/.env** | ⚠️ | Copy from `.env.example` (gitignored) |
| **Root README** | ✅ Fixed | Added |
| **backend/.env.example** | ✅ Fixed | Added |
| **frontend/.env.example** | ✅ Fixed | Added |
| **Redis healthcheck** | ✅ Fixed | Added to docker-compose |
| **Shared Laravel env (DRY)** | ✅ Fixed | `x-laravel-env` anchor |
| **Scheduler MySQL dependency** | ✅ Fixed | `depends_on mysql: healthy` |
| **APP_KEY strategy** | ✅ Fixed | entrypoint generates if missing; prefer `.env` |
| **storage:link** | ✅ Fixed | entrypoint runs `artisan storage:link` |
| **DB wait in entrypoint** | ✅ Fixed | PDO retry loop for queue/scheduler |
| **frontend node_modules volume** | ✅ Fixed | named volume `frontend_node_modules` |

---

## 2. Already Correct Components

| Component | Notes |
|-----------|-------|
| **MySQL 8** | `mysql_data` volume, healthcheck, credentials |
| **Redis 7** | Internal only, AOF persistence, `redis_data` volume |
| **PHP-FPM app** | PHP 8.3, redis ext, composer in image |
| **Nginx** | Proxies to `app:9000`, serves `public/` |
| **Queue worker** | `queue:work redis --sleep=1 --tries=3` |
| **Scheduler** | `schedule:work` (Laravel 11+ native) |
| **Frontend** | Node 22, bind mount + anonymous node_modules, port 3000 |
| **Network** | Single bridge `agencypulse` |
| **API routing stub** | `/api/v1/health` defined in routes |

---

## 3. Nginx Routing Note

Nginx **only** proxies the Laravel API (port 8080). Next.js runs on **port 3000** separately. This is intentional for dev hot-reload. Production would use a single edge proxy — out of scope for Story 1.1.

---

## 4. Environment Consistency Matrix

| Variable | backend/.env.example | docker-compose | Match |
|----------|---------------------|----------------|-------|
| DB_HOST | mysql | mysql | ✅ |
| REDIS_HOST | redis | redis | ✅ |
| QUEUE_CONNECTION | redis | redis | ✅ |
| APP_URL | localhost:8080 | localhost:8080 | ✅ |
| NEXT_PUBLIC_API_URL | — | localhost:8080/api/v1 | ✅ (browser → host) |

---

## 5. Recommended Run Order

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
docker compose logs -f app          # wait for "Database is ready" + composer
docker compose exec app php artisan migrate
curl http://localhost:8080/api/v1/health
curl http://localhost:3000
docker compose logs queue --tail 20  # verify no crash loop
docker compose logs scheduler --tail 20
```

---

## 6. Gate to Story 3.1 (Timer)

| Gate | Required |
|------|----------|
| `docker compose up` all services healthy | ✅ Infra ready |
| `/api/v1/health` returns 200 | ❌ Blocked on Laravel skeleton |
| Redis connected | ❌ Blocked until Laravel boots |
| Queue worker running | ⚠️ Runs but needs Laravel |
| Migrations applied | ❌ Blocked |

**Verdict:** Infrastructure layer is **complete**. Complete **Story 1.1 Laravel bootstrap** (app/, config/, middleware stubs, HealthController) before Story 3.1.
