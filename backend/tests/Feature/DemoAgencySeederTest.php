<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\Organization;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Demo\DemoAgencySeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoAgencySeederTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'demo-password-123';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        config([
            'demo.admin_email' => 'demo@agencypulse.app',
            'demo.admin_password' => self::PASSWORD,
            'demo.payroll_pin' => '4321',
        ]);
    }

    public function test_seed_command_builds_a_complete_demo_agency(): void
    {
        $this->artisan('demo:seed')->assertSuccessful();

        $org = Organization::query()->where('slug', DemoAgencySeeder::SLUG)->firstOrFail();
        $this->assertTrue($org->onboarding_completed);
        $this->assertSame(10, User::query()->where('organization_id', $org->id)->count());
        $this->assertSame(6, $org->projects()->count());

        $entries = TimeEntry::query()->where('organization_id', $org->id);
        $this->assertGreaterThan(200, (clone $entries)->where('type', TimeEntryType::Tracked)->count());
        $this->assertGreaterThan(0, (clone $entries)->where('type', TimeEntryType::Manual)->where('status', TimeEntryStatus::Pending)->count());
        $this->assertGreaterThan(0, (clone $entries)->where('type', TimeEntryType::Manual)->where('status', TimeEntryStatus::Approved)->count());
        $this->assertSame(6, (clone $entries)->where('type', TimeEntryType::Leave)->count());
    }

    public function test_demo_admin_can_sign_in_and_see_profitability(): void
    {
        $this->artisan('demo:seed')->assertSuccessful();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'demo@agencypulse.app',
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');
        $this->assertNotEmpty($token);

        $admin = User::query()->where('email', 'demo@agencypulse.app')->firstOrFail();

        $report = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Organization-Id' => (string) $admin->organization_id,
            'X-Payroll-Pin' => '4321',
        ])->getJson('/api/v1/reports/profitability')->assertOk();

        $this->assertGreaterThan(0, $report->json('totals.revenue'));
        $this->assertGreaterThan(0, $report->json('totals.cost'));
        $this->assertCount(6, $report->json('projects'));
        $titles = collect($report->json('insights'))->pluck('title')->implode(' | ');
        $this->assertStringContainsString('Brand Refresh', $titles);

        $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Organization-Id' => (string) $admin->organization_id,
        ])->getJson('/api/v1/dashboard')->assertOk();
    }

    public function test_demo_staff_cannot_sign_in(): void
    {
        $this->artisan('demo:seed')->assertSuccessful();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'ayesha@'.DemoAgencySeeder::EMAIL_DOMAIN,
            'password' => 'password',
        ])->assertStatus(422);
    }

    public function test_if_missing_is_idempotent_and_plain_seed_refuses_duplicates(): void
    {
        $this->artisan('demo:seed')->assertSuccessful();
        $this->artisan('demo:seed --if-missing')->assertSuccessful();
        $this->artisan('demo:seed')->assertFailed();

        $this->assertSame(1, Organization::query()->where('slug', DemoAgencySeeder::SLUG)->count());
    }

    public function test_fresh_rebuilds_and_remove_deletes_everything(): void
    {
        $this->artisan('demo:seed')->assertSuccessful();
        $this->artisan('demo:seed --fresh')->assertSuccessful();
        $this->assertSame(1, Organization::query()->where('slug', DemoAgencySeeder::SLUG)->count());

        $real = User::factory()->admin()->create();

        $this->artisan('demo:remove')->assertSuccessful();

        $this->assertFalse(Organization::query()->where('slug', DemoAgencySeeder::SLUG)->exists());
        $this->assertSame(0, User::query()->where('email', 'like', '%@'.DemoAgencySeeder::EMAIL_DOMAIN)->count());
        $this->assertFalse(User::query()->where('email', 'demo@agencypulse.app')->exists());
        // Real companies are untouched.
        $this->assertTrue(User::query()->whereKey($real->id)->exists());
    }

    public function test_weak_password_or_bad_pin_is_refused(): void
    {
        config(['demo.admin_password' => 'short']);
        $this->artisan('demo:seed')->assertFailed();

        config(['demo.admin_password' => self::PASSWORD, 'demo.payroll_pin' => 'abcd']);
        $this->artisan('demo:seed')->assertFailed();

        $this->assertFalse(Organization::query()->where('slug', DemoAgencySeeder::SLUG)->exists());
    }
}
