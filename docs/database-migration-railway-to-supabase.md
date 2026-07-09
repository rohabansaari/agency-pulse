# Migrate AgencyPulse from Railway MySQL to Supabase PostgreSQL

This guide moves **existing production data** from Railway MySQL to Supabase PostgreSQL while preserving IDs, foreign keys, and timestamps.

For a **new** deployment with no data, skip to [Fresh Supabase setup](#fresh-supabase-setup) in `DEPLOY.md`.

---

## Overview

| Step | Action |
|------|--------|
| 1 | Export MySQL data from Railway |
| 2 | Run Laravel migrations on empty Supabase Postgres |
| 3 | Import data into Supabase (preserve IDs) |
| 4 | Point Render `DB_*` env vars at Supabase |
| 5 | Verify and cut over |

AgencyPulse uses **PostgreSQL-native migrations** — run `php artisan migrate` against Supabase before importing data.

---

## Prerequisites

- Railway MySQL still accessible (public networking enabled)
- Supabase project created (see `DEPLOY.md` Part 1)
- Local tools: `mysqldump`, `psql`, optional [pgloader](https://pgloader.io/)
- This repo checked out at the commit that includes PostgreSQL support

---

## Step 1 — Export Railway MySQL

From your machine (replace placeholders):

```bash
mysqldump \
  -h YOUR_RAILWAY_PUBLIC_HOST \
  -P YOUR_RAILWAY_PORT \
  -u root \
  -p \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  YOUR_DATABASE_NAME \
  > agencypulse_mysql_backup.sql
```

Verify the dump:

```bash
head -n 30 agencypulse_mysql_backup.sql
wc -l agencypulse_mysql_backup.sql
```

Store the file securely — it contains production data.

---

## Step 2 — Prepare Supabase schema

1. On Render (or locally with Supabase credentials), set:

```env
DB_CONNECTION=pgsql
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=your-supabase-password
DB_SCHEMA=public
DB_SSLMODE=require
```

2. Run migrations against **empty** Supabase:

```bash
php artisan migrate --force
php artisan migrate:status
```

3. Confirm tables exist in Supabase → **Table Editor**.

---

## Step 3 — Import data (choose one method)

### Option A — pgloader (recommended for full database)

Install pgloader, then create `mysql-to-pg.load`:

```lisp
LOAD DATABASE
     FROM mysql://root:PASSWORD@HOST:PORT/DATABASE
     INTO postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require

 WITH include drop, create tables, create indexes, reset sequences,
      workers = 4, concurrency = 1

 SET maintenance_work_mem to '128MB',
     work_mem to '12MB'

 CAST type datetime to timestamptz drop default drop not null using zero-digits-to-null,
      type date drop not null drop default using zero-digits-to-null

 ALTER SCHEMA 'DATABASE' RENAME TO 'public';
```

**Important:** If you already ran Laravel migrations on Supabase, use **data-only** import instead of `include drop`:

1. Truncate Supabase tables (respect FK order) or use a fresh Supabase project.
2. Prefer **Option B** (table-by-table) when Laravel owns the schema.

### Option B — Laravel table export/import (safest with Laravel schema)

Export MySQL tables to CSV/JSON and import via a one-off script, **preserving `id` columns** and inserting in FK order:

1. `organizations`
2. `users`
3. `organization_members`
4. `teams`, `team_user`, `projects`, `project_assignments`
5. `time_entries`, `screenshots`, payroll tables, etc.
6. Spatie permission tables (`roles`, `permissions`, pivots)
7. `migrations` — copy MySQL migration batch rows so Laravel knows history

Example export from MySQL:

```bash
mysql -h HOST -P PORT -u root -p -e "SELECT * FROM organizations" DATABASE > organizations.tsv
```

Example import to Postgres (after migrations):

```bash
psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require" \
  -c "\copy organizations FROM 'organizations.tsv' WITH (FORMAT csv, HEADER true)"
```

Repeat for each table in dependency order.

### Option C — Fresh start (no data migration)

If production data is disposable:

1. Run migrations on Supabase only.
2. Re-seed: `php artisan db:seed` (if applicable).
3. Recreate orgs/users via Platform UI.

---

## Step 4 — Reset PostgreSQL sequences

After importing rows with explicit IDs, reset sequences so new inserts do not collide:

```sql
-- Run in Supabase SQL Editor for each serial/bigserial table, e.g.:
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('organizations', 'id'), COALESCE((SELECT MAX(id) FROM organizations), 1));
-- Repeat for all tables with auto-incrementing id columns.
```

Or from Laravel tinker — loop tables and call `DB::statement("SELECT setval(...)")`.

---

## Step 5 — Update Render environment

On **agencypulse-api** → **Environment**, replace Railway MySQL vars:

| Remove (Railway) | Add (Supabase) |
|------------------|----------------|
| `DB_CONNECTION=mysql` | `DB_CONNECTION=pgsql` |
| Railway host/port | `DB_HOST=db.xxxxx.supabase.co` |
| | `DB_PORT=5432` |
| | `DB_DATABASE=postgres` |
| | `DB_USERNAME=postgres` |
| | `DB_PASSWORD=…` |
| | `DB_SCHEMA=public` |
| | `DB_SSLMODE=require` |

Save → redeploy → check logs for `Running migrations...` success.

---

## Step 6 — Verification checklist

```bash
curl https://YOUR-API.onrender.com/api/v1/health
```

Manual checks:

- [ ] Login as super admin
- [ ] Login as org admin
- [ ] Dashboard loads
- [ ] Team list / employees
- [ ] Time tracking create/stop
- [ ] Screenshots upload/list
- [ ] Payroll run (if used)
- [ ] Invitation email send
- [ ] Queue jobs (if using database queue)

Compare row counts:

```sql
-- Supabase SQL Editor
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'time_entries', COUNT(*) FROM time_entries;
```

Match against MySQL counts before decommissioning Railway.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `SQLSTATE[08006]` / SSL | Set `DB_SSLMODE=require` |
| Duplicate key on insert | Reset sequences (Step 4) |
| Foreign key violation on import | Import tables in dependency order |
| `column "x" is of type boolean but expression is of type integer` | MySQL `0/1` → cast to `true/false` during import |
| Migration fails on Supabase | Ensure latest code with PostgreSQL migrations is deployed |
| Laravel tries to re-run migrations | Copy `migrations` table from MySQL or mark batches manually |

---

## Rollback

Keep Railway MySQL running until Supabase is verified for at least 24–48 hours.

To roll back Render:

1. Restore previous `DB_*` Railway values.
2. Redeploy API.
3. Do **not** run migrations against MySQL with PostgreSQL-only migration code — check out the previous git tag if needed.

---

## Fresh Supabase setup

See **[DEPLOY.md](../DEPLOY.md)** Part 1 and Part 2 — no data import required.
