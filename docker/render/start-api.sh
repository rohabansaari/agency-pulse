#!/bin/sh
set -e

cd /var/www/html

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY is not set. Add APP_KEY in Render Environment (or let Render generate one)."
    exit 1
fi

echo "Discovering packages..."
php artisan package:discover --ansi

echo "Caching Laravel configuration..."
php artisan config:cache
php artisan route:clear

echo "Running migrations..."
php artisan migrate --force --no-interaction

echo "Linking public storage..."
php artisan storage:link --force --no-interaction 2>/dev/null || true

echo "Ensuring platform super admin exists..."
php artisan super-admin:ensure --no-interaction

echo "Starting Laravel scheduler in background (screenshot retention purge)..."
(while true; do php artisan schedule:run --no-interaction; sleep 60; done) &

echo "Starting API on port ${PORT:-10000}..."
exec php artisan serve --host=0.0.0.0 --port="${PORT:-10000}"
