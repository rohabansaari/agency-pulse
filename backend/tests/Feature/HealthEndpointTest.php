<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertJsonStructure([
                'status',
                'service',
                'timestamp',
                'screenshot_disk',
                'screenshot_s3_configured',
                'checks' => ['app_key_configured', 'database', 'database_error_code', 'migrated'],
            ])
            ->assertJson([
                'status' => 'ok',
                'service' => 'AgencyPulse API',
                'checks' => ['app_key_configured' => true, 'database' => 'ok'],
            ]);
    }
}
