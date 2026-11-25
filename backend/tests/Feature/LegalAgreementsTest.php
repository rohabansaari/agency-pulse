<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ConnectsDesktopAgent;
use Tests\TestCase;

class LegalAgreementsTest extends TestCase
{
    use ConnectsDesktopAgent, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    public function test_sign_up_requires_agreeing_to_the_terms(): void
    {
        config(['auth.self_signup' => true]);
        $form = [
            'name' => 'Sara Khan',
            'organization_name' => 'Pixel Studio',
            'email' => 'sara@pixel.test',
            'password' => 'secret123',
        ];

        $this->postJson('/api/v1/auth/register', $form)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('accept_terms');

        $this->postJson('/api/v1/auth/register', $form + ['accept_terms' => true])
            ->assertCreated()
            ->assertJsonPath('user.terms_acceptance_required', false)
            ->assertJsonPath('user.monitoring_consent_required', true);

        $user = User::query()->where('email', 'sara@pixel.test')->sole();
        $this->assertNotNull($user->terms_accepted_at);
        $this->assertSame(config('legal.terms_version'), $user->terms_version);
    }

    public function test_timer_waits_for_the_monitoring_notice(): void
    {
        $user = User::factory()->employee()->withoutAgreements()->create();
        Sanctum::actingAs($user);
        $this->connectDesktopAgent($user);

        $this->withHeaders($this->headers($user))->getJson('/api/v1/auth/me')
            ->assertJsonPath('user.monitoring_consent_required', true)
            ->assertJsonPath('user.terms_acceptance_required', false);

        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/start')
            ->assertForbidden()
            ->assertJsonPath('code', 'monitoring_consent_required');

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/auth/agreements', ['monitoring_notice' => true])
            ->assertOk()
            ->assertJsonPath('user.monitoring_consent_required', false);

        $user->refresh();
        $this->assertNotNull($user->monitoring_consent_at);
        $this->assertSame(config('legal.monitoring_notice_version'), $user->monitoring_consent_version);
        $this->assertNotNull($user->monitoring_consent_ip);

        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/start')->assertCreated();
    }

    public function test_notice_must_be_accepted_not_just_sent(): void
    {
        $user = User::factory()->employee()->withoutAgreements()->create();
        Sanctum::actingAs($user);

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/auth/agreements', ['monitoring_notice' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('monitoring_notice');
    }

    public function test_existing_admins_accept_the_terms_with_the_notice(): void
    {
        $admin = User::factory()->admin()->withoutAgreements()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))->getJson('/api/v1/auth/me')
            ->assertJsonPath('user.terms_acceptance_required', true);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/auth/agreements', ['monitoring_notice' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('terms');

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/auth/agreements', ['monitoring_notice' => true, 'terms' => true])
            ->assertOk()
            ->assertJsonPath('user.terms_acceptance_required', false)
            ->assertJsonPath('user.monitoring_consent_required', false);
    }

    public function test_a_new_notice_version_asks_again(): void
    {
        $user = User::factory()->employee()->create();
        $this->assertFalse($user->needsMonitoringConsent());

        config(['legal.monitoring_notice_version' => '2027-01-01']);
        $this->assertTrue($user->fresh()->needsMonitoringConsent());
    }
}
