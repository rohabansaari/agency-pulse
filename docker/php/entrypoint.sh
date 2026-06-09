#!/bin/sh
set -e

cd /var/www/html

# ── 1. Environment file ──────────────────────────────────────────────────────
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
    else
        echo "WARNING: No .env or .env.example found. Laravel may fail to boot."
    fi
fi

# ── 2. Composer dependencies ─────────────────────────────────────────────────
if [ ! -f vendor/autoload.php ]; then
    echo "Installing Composer dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# ── 3. Wait for MySQL (queue/scheduler/workers start before app is warm) ─────
if [ -n "$DB_HOST" ]; then
    echo "Waiting for database at ${DB_HOST}:${DB_PORT:-3306}..."
    for i in $(seq 1 30); do
        if php -r "
            try {
                new PDO(
                    'mysql:host=${DB_HOST};port=${DB_PORT:-3306};dbname=${DB_DATABASE}',
                    '${DB_USERNAME}',
                    '${DB_PASSWORD}',
                    [PDO::ATTR_TIMEOUT => 2]
                );
                exit(0);
            } catch (Exception \$e) {
                exit(1);
            }
        " 2>/dev/null; then
            echo "Database is ready."
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo "WARNING: Database not reachable after 30 attempts. Continuing anyway."
        fi
        sleep 2
    done
fi

# ── 4. Application key ───────────────────────────────────────────────────────
# APP_KEY lives in backend/.env only (never set via Docker Compose env).
if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
    echo "Generating APP_KEY..."
    php artisan key:generate --force --no-interaction 2>/dev/null || true
fi

# ── 5. Storage & cache ───────────────────────────────────────────────────────
mkdir -p storage/framework/{cache/data,sessions,views,testing} storage/logs bootstrap/cache
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

if [ ! -L public/storage ]; then
    php artisan storage:link --force 2>/dev/null || true
fi

php artisan config:clear 2>/dev/null || true
php artisan route:clear 2>/dev/null || true

exec "$@"
