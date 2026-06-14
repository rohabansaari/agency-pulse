<?php

namespace Tests\Feature;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Mail\AccountInvitationMail;
use App\Models\InvitationToken;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\InvitationService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use App\Services\Auth\SuperAdminBootstrap;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvitationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_platform_org_creation_sends_admin_invitation(): void
    {
        Mail::fake();

        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/v1/platform/organizations', [
            'organization_name' => 'Acme Agency',
            'admin_name' => 'Jane Admin',
            'admin_email' => 'jane@acme.test',
        ]);

        $response->assertCreated();

        $admin = User::query()->where('email', 'jane@acme.test')->first();
        $this->assertNotNull($admin);
        $this->assertTrue(
            OrganizationMember::query()
                ->where('user_id', $admin->id)
                ->where('status', OrganizationMemberStatus::Invited)
                ->exists()
        );

        Mail::assertSent(AccountInvitationMail::class, fn ($mail) => $mail->hasTo('jane@acme.test'));
    }

    public function test_platform_org_creation_succeeds_when_mail_fails(): void
    {
        Mail::shouldReceive('to')->once()->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('SMTP connection failed'));

        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/v1/platform/organizations', [
            'organization_name' => 'Mail Fail Org',
            'admin_name' => 'Fail Admin',
            'admin_email' => 'fail-admin@acme.test',
        ]);

        $response->assertCreated()
            ->assertJsonPath('invitation_email_sent', false)
            ->assertJsonPath('organization.name', 'Mail Fail Org');

        $this->assertDatabaseHas('organizations', ['name' => 'Mail Fail Org']);
        $this->assertDatabaseHas('users', ['email' => 'fail-admin@acme.test']);
    }

    public function test_employee_creation_sends_invitation_and_blocks_login_until_activation(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $response = $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'New Employee',
                'email' => 'employee@example.com',
                'role' => UserRole::Employee->value,
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ]);

        $response->assertCreated()
            ->assertJsonPath('member.status', OrganizationMemberStatus::Invited->value);

        Mail::assertSent(AccountInvitationMail::class);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'employee@example.com',
            'password' => 'password123',
        ])->assertUnprocessable();
    }

    public function test_accept_invitation_activates_account_and_allows_login(): void
    {
        Mail::fake();

        $organization = Organization::factory()->create();
        $result = app(InvitationService::class)->createInvitedMember(
            $organization,
            'Invited User',
            'invited@example.com',
            UserRole::Employee,
        );

        $plainToken = $result['plain_token'];

        $this->getJson('/api/v1/auth/invitation?token='.$plainToken)
            ->assertOk()
            ->assertJsonPath('invitation.email', 'invited@example.com');

        $this->postJson('/api/v1/auth/accept-invitation', [
            'token' => $plainToken,
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertOk();

        $member = OrganizationMember::query()
            ->where('user_id', $result['user']->id)
            ->first();

        $this->assertSame(OrganizationMemberStatus::Active, $member->status);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'invited@example.com',
            'password' => 'Password1!',
        ])->assertOk();
    }

    public function test_admin_and_employee_invitations_use_same_mailable(): void
    {
        Mail::fake();

        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/v1/platform/organizations', [
            'organization_name' => 'Same Mail Org',
            'admin_name' => 'Jane Admin',
            'admin_email' => 'same-mail-admin@acme.test',
        ])->assertCreated();

        Mail::assertSent(AccountInvitationMail::class, fn ($mail) => $mail->hasTo('same-mail-admin@acme.test'));

        $admin = User::query()->where('email', 'same-mail-admin@acme.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Team Member',
                'email' => 'same-mail-employee@acme.test',
                'role' => UserRole::Employee->value,
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated()
            ->assertJsonPath('invitation_email_sent', true);

        Mail::assertSent(AccountInvitationMail::class, fn ($mail) => $mail->hasTo('same-mail-employee@acme.test'));
    }

    public function test_manager_and_sub_admin_creation_send_invitations(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        foreach ([UserRole::Manager, UserRole::SubAdmin] as $role) {
            $email = $role->value.'@example.com';

            $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
                ->postJson('/api/v1/team/create-employee', [
                    'name' => ucfirst($role->value),
                    'email' => $email,
                    'role' => $role->value,
                    'salary_type' => 'hourly',
                    'hourly_rate' => 50,
                    'payroll_pin' => '1234',
                    'payroll_pin_confirmation' => '1234',
                ])
                ->assertCreated()
                ->assertJsonPath('invitation_email_sent', true);

            Mail::assertSent(AccountInvitationMail::class, fn ($mail) => $mail->hasTo($email));
        }
    }

    public function test_expired_invitation_token_is_rejected(): void
    {
        $organization = Organization::factory()->create();
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'email' => 'expired@example.com',
        ]);

        OrganizationMember::query()
            ->where('user_id', $user->id)
            ->update(['status' => OrganizationMemberStatus::Invited]);

        $plainToken = 'expired-token-value-123456789012345678901234567890123456789012345678901234';
        InvitationToken::create([
            'user_id' => $user->id,
            'organization_id' => $organization->id,
            'token_hash' => hash('sha256', $plainToken),
            'sent_at' => now()->subDays(2),
            'expires_at' => now()->subDay(),
        ]);

        $this->getJson('/api/v1/auth/invitation?token='.$plainToken)
            ->assertUnprocessable();
    }

    public function test_admin_can_resend_invitation_for_pending_member(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        $employee = User::factory()->employee()->create([
            'organization_id' => $admin->organization_id,
        ]);

        OrganizationMember::query()
            ->where('organization_id', $admin->organization_id)
            ->where('user_id', $employee->id)
            ->update([
                'status' => OrganizationMemberStatus::Invited,
                'invited_at' => now()->subHour(),
                'joined_at' => null,
            ]);

        Sanctum::actingAs($admin);

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson("/api/v1/team/{$employee->id}/resend-invitation")
            ->assertOk();

        Mail::assertSent(AccountInvitationMail::class);
    }

    public function test_invitations_send_endpoint_creates_member_and_sends_email(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $response = $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/invitations/send', [
                'email' => 'manager@example.com',
                'name' => 'John Doe',
                'role' => 'manager',
            ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('invitation_email_sent', true)
            ->assertJsonPath('expires_in_hours', 48)
            ->assertJsonStructure(['invite_link']);

        Mail::assertSent(AccountInvitationMail::class, fn ($mail) => $mail->hasTo('manager@example.com'));
    }

    public function test_duplicate_invite_within_one_minute_is_rejected(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        $employee = User::factory()->employee()->create([
            'organization_id' => $admin->organization_id,
        ]);

        OrganizationMember::query()
            ->where('organization_id', $admin->organization_id)
            ->where('user_id', $employee->id)
            ->update([
                'status' => OrganizationMemberStatus::Invited,
                'invited_at' => now(),
                'joined_at' => null,
            ]);

        InvitationToken::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'token_hash' => hash('sha256', 'recent-token'),
            'sent_at' => now(),
            'expires_at' => now()->addHours(48),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson("/api/v1/team/{$employee->id}/resend-invitation")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);
    }

    public function test_invitation_email_uses_role_in_subject(): void
    {
        Mail::fake();

        $organization = Organization::factory()->create();
        $result = app(InvitationService::class)->createInvitedMember(
            $organization,
            'Role User',
            'role-user@example.com',
            UserRole::SubAdmin,
        );

        Mail::assertSent(
            AccountInvitationMail::class,
            fn (AccountInvitationMail $mail) => str_contains(
                $mail->envelope()->subject,
                'Sub Admin',
            ) && $mail->hasTo('role-user@example.com'),
        );

        $this->assertNotEmpty($result['plain_token']);
    }

    public function test_suspended_member_cannot_login(): void
    {
        $user = User::factory()->employee()->create([
            'password' => Hash::make('Password1!'),
        ]);

        OrganizationMember::query()
            ->where('user_id', $user->id)
            ->update(['status' => OrganizationMemberStatus::Suspended]);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertUnprocessable();
    }
}
