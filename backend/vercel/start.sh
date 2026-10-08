#!/bin/sh
# Container entrypoint for the Vercel "api" service.
set -e

cd /app

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables." >&2
    exit 1
fi

mkdir -p "${VIEW_COMPILED_PATH:-/tmp/views}"

# Migrations are idempotent; a no-op boot costs one query. Set RUN_MIGRATIONS_ON_BOOT=false
# to run them from CI instead. Failures are logged but don't block serving.
if [ "${RUN_MIGRATIONS_ON_BOOT:-true}" = "true" ]; then
    php artisan migrate --force --no-interaction || echo "WARN: migrations failed" >&2
    php artisan super-admin:ensure --no-interaction || echo "WARN: super-admin:ensure failed" >&2
fi

exec frankenphp php-server --root public/ --listen ":${PORT:-8080}"
