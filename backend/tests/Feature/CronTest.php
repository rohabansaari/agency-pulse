<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class CronTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_cron_rejects_missing_or_wrong_secret(): void
    {
        Config::set('services.cron.secret', 'cron-secret');

        $this->getJson('/api/v1/cron/daily')->assertUnauthorized();

        $this->withToken('wrong-secret')
            ->getJson('/api/v1/cron/daily')
            ->assertUnauthorized();
    }

    public function test_daily_cron_is_disabled_without_configured_secret(): void
    {
        Config::set('services.cron.secret', '');

        $this->withToken('')
            ->getJson('/api/v1/cron/daily')
            ->assertUnauthorized();
    }

    public function test_daily_cron_runs_maintenance_commands(): void
    {
        Config::set('services.cron.secret', 'cron-secret');

        $this->withToken('cron-secret')
            ->getJson('/api/v1/cron/daily')
            ->assertOk()
            ->assertJsonPath('commands.idempotency:purge', 0)
            ->assertJsonPath('commands.screenshots:purge-expired', 0);
    }
}
