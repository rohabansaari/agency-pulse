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
        $this->assertStringContainsString('MAIL_MAILER must be piisend', $issue);
    }

    public function test_piisend_mailer_requires_api_key(): void
    {
        Config::set('mail.default', 'piisend');
        Config::set('services.piisend.key', '');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertSame(
            'PIISEND_API_KEY is not set. Sign up at piisend.com → API → Keys → create a key with emails:send scope.',
            $issue,
        );
    }

    public function test_piisend_mailer_is_configured_without_from_address(): void
    {
        Config::set('mail.default', 'piisend');
        Config::set('services.piisend.key', 'pii_test_key');
        Config::set('mail.from.address', '');

        $mailConfiguration = app(MailConfiguration::class);

        $this->assertNull($mailConfiguration->configurationIssue());
        $this->assertTrue($mailConfiguration->isRealDeliveryConfigured());
    }

    public function test_mailersend_mailer_requires_api_key(): void
    {
        Config::set('mail.default', 'mailersend');
        Config::set('services.mailersend.key', '');
        Config::set('mail.from.address', 'noreply@example.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertSame(
            'MAILERSEND_API_KEY is not set. Create an API token in the MailerSend dashboard.',
            $issue,
        );
    }

    public function test_mailersend_mailer_rejects_gmail_from_address(): void
    {
        Config::set('mail.default', 'mailersend');
        Config::set('services.mailersend.key', 'mlsn_test_key');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertStringContainsString('Gmail addresses cannot be used', $issue);
    }

    public function test_mailersend_mailer_rejects_placeholder_from_address(): void
    {
        Config::set('mail.default', 'mailersend');
        Config::set('services.mailersend.key', 'mlsn_test_key');
        Config::set('mail.from.address', 'hello@example.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertStringContainsString('placeholder', $issue);
    }

    public function test_mailersend_mailer_rejects_trial_sender_domain(): void
    {
        Config::set('mail.default', 'mailersend');
        Config::set('services.mailersend.key', 'mlsn_test_key');
        Config::set('mail.from.address', 'noreply@trial-abc.mlsender.net');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertStringContainsString('trial domain', $issue);
        $this->assertStringContainsString('2 unique recipients', $issue);
    }

    public function test_mail_status_reports_trial_sender_domain_flag(): void
    {
        Config::set('mail.default', 'mailersend');
        Config::set('services.mailersend.key', 'mlsn_test_key');
        Config::set('mail.from.address', 'noreply@trial-abc.mlsender.net');

        $status = app(MailConfiguration::class)->status();

        $this->assertTrue($status['using_trial_mailersend_sender']);
        $this->assertNotNull($status['issue']);
    }

    public function test_brevo_mailer_requires_api_key(): void
    {
        Config::set('mail.default', 'brevo');
        Config::set('services.brevo.key', '');
        Config::set('mail.from.address', 'noreply@yourdomain.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertSame(
            'BREVO_API_KEY is not set. Create an HTTP API key at app.brevo.com → SMTP & API → API keys (starts with xkeysib-).',
            $issue,
        );
    }

    public function test_brevo_mailer_allows_verified_gmail_sender(): void
    {
        Config::set('mail.default', 'brevo');
        Config::set('services.brevo.key', 'xkeysib_test_key');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $mailConfiguration = app(MailConfiguration::class);

        $this->assertNull($mailConfiguration->configurationIssue());
        $this->assertNotNull($mailConfiguration->brevoSenderVerificationHint());
    }

    public function test_brevo_mailer_rejects_smtp_key_prefix(): void
    {
        Config::set('mail.default', 'brevo');
        Config::set('services.brevo.key', 'xsmtpsib-test-key');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertStringContainsString('xsmtpsib-', $issue);
        $this->assertStringContainsString('xkeysib-', $issue);
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
        $this->assertStringContainsString('MAIL_MAILER=piisend', $hint);
    }

    public function test_smtp_mailer_requires_matching_from_address(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.username', 'agencypulse.notifications@gmail.com');
        Config::set('mail.mailers.smtp.password', 'apppassword123456');
        Config::set('mail.from.address', 'other@gmail.com');

        $issue = app(MailConfiguration::class)->configurationIssue();

        $this->assertSame(
            'MAIL_FROM_ADDRESS must exactly match EMAIL_USER for Gmail SMTP.',
            $issue,
        );
    }

    public function test_smtp_mailer_accepts_email_user_alias(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.username', 'agencypulse.notifications@gmail.com');
        Config::set('mail.mailers.smtp.password', 'apppassword123456');
        Config::set('mail.from.address', 'agencypulse.notifications@gmail.com');

        $this->assertNull(app(MailConfiguration::class)->configurationIssue());
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
                'mail' => [
                    'mailer',
                    'configured',
                    'issue',
                    'render_smtp_blocked_hint',
                    'from_address',
                    'using_trial_mailersend_sender',
                    'recommended_mailer',
                    'providers',
                    'host',
                    'port',
                ],
            ]);
    }
}
