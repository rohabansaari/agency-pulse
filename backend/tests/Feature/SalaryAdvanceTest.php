<?php

namespace Tests\Feature;

use App\Enums\AdvanceRequestStatus;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SalaryAdvanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    public function test_manager_can_request_salary_advance(): void
    {
        $manager = User::factory()->manager()->create();
        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/hr/advances', [
                'amount' => 2500,
                'reason' => 'Emergency expense',
            ])
            ->assertCreated()
            ->assertJsonPath('request.user_id', $manager->id)
            ->assertJsonPath('request.status', AdvanceRequestStatus::Pending->value);
    }

    public function test_admin_can_list_pending_manager_advance_requests(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create([
            'organization_id' => $admin->organization_id,
        ]);

        SalaryAdvanceRequest::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $manager->id,
            'amount' => 3000,
            'reason' => 'Medical bills',
            'status' => AdvanceRequestStatus::Pending,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/hr/advances/pending')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $manager->id);
    }

    public function test_admin_can_list_all_advance_requests_for_history(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create([
            'organization_id' => $admin->organization_id,
        ]);

        SalaryAdvanceRequest::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $manager->id,
            'amount' => 1500,
            'reason' => 'Travel',
            'status' => AdvanceRequestStatus::Approved,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/hr/advances')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $manager->id);
    }
}
