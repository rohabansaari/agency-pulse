# AgencyPulse — Workforce Management SaaS

Multi-tenant agency workforce platform (Laravel 12 + Next.js).

## Prerequisites

- Docker Desktop 4.x+ (Compose v2)
- Git

## Quick Start

```bash
# 1. Backend environment
cp backend/.env.example backend/.env

# 2. Frontend environment (optional — docker-compose sets defaults)
cp frontend/.env.example frontend/.env.local

# 3. Build and start all services
docker compose up -d --build

# 4. Run migrations
docker compose exec app php artisan migrate

# 5. Verify services
curl http://localhost:8080/up                  # Laravel health
curl http://localhost:8080/api/v1/health       # API v1 health
open http://localhost:8080                     # Full app (UI + API)
```

## Services

| Service    | URL / Port              | Purpose                    |
|------------|-------------------------|----------------------------|
| nginx      | http://localhost:8080   | App entry (UI proxied + API) |
| frontend   | http://localhost:3000   | Next.js dev server (direct)  |
| postgres   | internal:5432           | Primary database (PostgreSQL 16) |
| redis      | internal:6379           | Cache, sessions, queues    |
| queue      | —                       | `queue:work` worker        |
| scheduler  | —                       | `schedule:work` runner     |

## Persistence

- **PostgreSQL:** `postgres_data` Docker volume — survives `docker compose down`
- **Redis:** `redis_data` volume with AOF (`appendonly yes`) — queue/cache survive restarts

## Common Commands

```bash
# Logs
docker compose logs -f app queue scheduler

# Artisan
docker compose exec app php artisan migrate
docker compose exec app php artisan tinker

# Queue worker status
docker compose exec queue php artisan queue:monitor redis:default

# Rebuild after Dockerfile changes
docker compose up -d --build

# Full reset (⚠ destroys DB data)
docker compose down -v
```

## Project Structure

```
backend/          Laravel 12 API
frontend/         Next.js App Router
docker/           PHP, Nginx, frontend Dockerfiles
docs/             Architecture & domain rules
_bmad-output/     Planning artifacts
```

## Deploy to production (Render + Supabase)

See **[DEPLOY.md](DEPLOY.md)** for Render web services + **Supabase PostgreSQL**.

Migrating existing Railway MySQL data? See **[docs/database-migration-railway-to-supabase.md](docs/database-migration-railway-to-supabase.md)**.

## Documentation

- [Domain rules](docs/architecture/domain-rules.md) — canonical business logic
- [Railway → Supabase migration](docs/database-migration-railway-to-supabase.md)
- [System architecture](_bmad-output/planning-artifacts/system-architecture-final.md)
- [Epics & stories](_bmad-output/planning-artifacts/epics.md)
