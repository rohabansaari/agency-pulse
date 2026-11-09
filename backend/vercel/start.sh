#!/bin/sh
# Container entrypoint for the Vercel "api" service.
cd /app

# Writable state lives under /tmp (see LARAVEL_STORAGE_PATH etc. in Dockerfile.vercel).
S="${LARAVEL_STORAGE_PATH:-/app/storage}"
mkdir -p "$S/app/public" "$S/app/private" "$S/framework/cache/data" "$S/framework/sessions" \
    "$S/framework/views" "$S/framework/testing" "$S/logs" \
    /tmp/laravel/cache "${XDG_CONFIG_HOME:-/tmp/caddy/config}" "${XDG_DATA_HOME:-/tmp/caddy/data}"

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy." >&2
fi

# Run migrations after the server is up so a slow first migration can't fail container startup.
# Set RUN_MIGRATIONS_ON_BOOT=false to run them from CI instead.
if [ "${RUN_MIGRATIONS_ON_BOOT:-true}" = "true" ]; then
    (
        php artisan migrate --force --no-interaction >&2 || echo "WARN: migrations failed" >&2
        php artisan super-admin:ensure --no-interaction >&2 || echo "WARN: super-admin:ensure failed" >&2
    ) &
fi

exec frankenphp php-server --root public/ --listen ":${PORT:-8080}"
