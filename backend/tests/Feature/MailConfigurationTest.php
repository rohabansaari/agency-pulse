<?php

namespace Tests\Feature;

use App\Services\Auth\SuperAdminBootstrap;
use App\Services\Mail\MailConfiguration;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MailConfigurationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_log_mailer_is_not_considered_real_delivery(): void
    {
        Config::set('mail.default', 'log');
        Config::set('mail.mailers.smtp.username', 'agencypulse.notifications@gmail.com');
        Config::set('mail.mailers.smtp.password', 'apppassword123456');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertNotNull($issue);
        $this->assertStringContainsString('MAIL_MAILER must be resend', $issue);
    }

    public function test_resend_mailer_requires_api_key(): void
    {
        Config::set('mail.default', 'resend');
        Config::set('services.resend.key', '');
        Config::set('mail.from.address', 'noreply@example.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertSame('RESEND_KEY is not set. Create a free API key at resend.com/api-keys.', $issue);
    }

    public function test_resend_mailer_rejects_gmail_from_address(): void
    {
        Config::set('mail.default', 'resend');
        Config::set('services.resend.key', 're_test_key');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertStringContainsString('Gmail addresses cannot be used', $issue);
    }

    public function test_smtp_on_render_shows_blocked_hint(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.username', 'agencypulse.notifications@gmail.com');
        Config::set('mail.mailers.smtp.password', 'apppassword123456');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $hint = app(MailConfiguration::class)->renderSmtpBlockedHint();

        $this->assertNotNull($hint);
        $this->assertStringContainsString('Render free tier blocks outbound SMTP', $hint);
    }

    public function test_smtp_mailer_requires_matching_from_address(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.username', 'agencypulse.notifications@gmail.com');
        Config::set('mail.mailers.smtp.password', 'apppassword123456');
        Config::set('mail.from.address', 'other@gmail.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertSame(
            'MAIL_FROM_ADDRESS must exactly match MAIL_USERNAME for Gmail SMTP.',
            $issue,
        );
    }

    public function test_runtime_fixes_strip_spaces_from_app_password(): void
    {
        Config::set('mail.mailers.smtp.password', 'abcd efgh ijkl mnop');

        app(MailConfiguration::class)->applyRuntimeFixes();

        $this->assertSame('abcdefghijklmnop', config('mail.mailers.smtp.password'));
    }

    public function test_super_admin_can_view_mail_status(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = \App\Models\User::query()
            ->where('email', SuperAdminBootstrap::EMAIL)
            ->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/v1/platform/mail/status')
            ->assertOk()
            ->assertJsonStructure([
                'mail' => ['mailer', 'configured', 'issue', 'render_smtp_blocked_hint', 'from_address', 'host', 'port'],
            ]);
    }
}
