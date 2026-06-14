<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Mail\AccountInvitationMail;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvitationDeliveryTraceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_create_employee_returns_delivery_trace_and_201_when_mail_fails(): void
    {
        Mail::shouldReceive('to')->once()->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('MS42225 unique recipients limit'));

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $response = $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Trace Employee',
                'email' => 'trace-employee@example.com',
                'role' => UserRole::Employee->value,
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ]);

        $response->assertCreated()
            ->assertJsonPath('invitation_email_sent', false)
            ->assertJsonPath('delivery.transaction_committed', true)
            ->assertJsonPath('delivery.invitation_token_exists', true)
            ->assertJsonPath('delivery.mail_dispatch_attempted', true)
            ->assertJsonPath('delivery.mail_dispatch_succeeded', false)
            ->assertJsonPath('member.email', 'trace-employee@example.com');

        $this->assertDatabaseHas('users', ['email' => 'trace-employee@example.com']);
    }

    public function test_duplicate_email_retry_returns_422_after_partial_success(): void
    {
        Mail::shouldReceive('to')->once()->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('MS42225 unique recipients limit'));

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $payload = [
            'name' => 'Retry Employee',
            'email' => 'retry-employee@example.com',
            'role' => UserRole::Employee->value,
            'salary_type' => 'hourly',
            'hourly_rate' => 50,
            'payroll_pin' => '1234',
            'payroll_pin_confirmation' => '1234',
        ];

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', $payload)
            ->assertCreated();

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_successful_create_includes_delivery_trace(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Sent Employee',
                'email' => 'sent-employee@example.com',
                'role' => UserRole::Employee->value,
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated()
            ->assertJsonPath('invitation_email_sent', true)
            ->assertJsonPath('delivery.transaction_committed', true)
            ->assertJsonPath('delivery.invitation_token_exists', true)
            ->assertJsonPath('delivery.mail_dispatch_succeeded', true);

        Mail::assertSent(AccountInvitationMail::class);
    }
}
