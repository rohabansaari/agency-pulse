<?php

namespace App\Services\Mail;

use Illuminate\Support\Facades\Log;

class MailConfiguration
{
    /** @var list<string> */
    private const REAL_DELIVERY_MAILERS = ['smtp', 'ses', 'postmark', 'resend'];

    public function applyRuntimeFixes(): void
    {
        $password = config('mail.mailers.smtp.password');
        if (is_string($password) && $password !== '') {
            config(['mail.mailers.smtp.password' => str_replace(' ', '', $password)]);
        }

        $username = config('mail.mailers.smtp.username');
        if (is_string($username) && $username !== '') {
            config(['mail.mailers.smtp.username' => trim($username)]);
        }

        $fromAddress = config('mail.from.address');
        if ((! is_string($fromAddress) || $fromAddress === '') && is_string($username) && $username !== '') {
            config(['mail.from.address' => trim($username)]);
        }
    }

    public function mailer(): string
    {
        return (string) config('mail.default', 'log');
    }

    public function isRealDeliveryConfigured(): bool
    {
        return $this->configurationIssue() === null;
    }

    public function configurationIssue(): ?string
    {
        $mailer = $this->mailer();

        if (! in_array($mailer, self::REAL_DELIVERY_MAILERS, true)) {
            return 'MAIL_MAILER must be resend (recommended on Render free tier) or smtp on a paid host. Currently "'.$mailer.'" only writes to logs.';
        }

        if ($mailer === 'resend') {
            return $this->resendConfigurationIssue();
        }

        if ($mailer !== 'smtp') {
            return null;
        }

        return $this->smtpConfigurationIssue();
    }

    public function renderSmtpBlockedHint(): ?string
    {
        if ($this->mailer() !== 'smtp') {
            return null;
        }

        return 'Render free tier blocks outbound SMTP (ports 465/587). Upgrade the API to a paid instance, or switch to MAIL_MAILER=resend with a Resend API key.';
    }

    private function resendConfigurationIssue(): ?string
    {
        $apiKey = (string) config('services.resend.key', '');
        $fromAddress = (string) config('mail.from.address', '');

        if ($apiKey === '') {
            return 'RESEND_KEY is not set. Create a free API key at resend.com/api-keys.';
        }

        if ($fromAddress === '') {
            return 'MAIL_FROM_ADDRESS is not set. Use an address on a domain you verified in Resend (e.g. noreply@yourdomain.com).';
        }

        if (str_ends_with(strtolower($fromAddress), '@gmail.com')) {
            return 'Gmail addresses cannot be used as the sender with Resend. Verify your own domain in Resend and set MAIL_FROM_ADDRESS to e.g. noreply@yourdomain.com.';
        }

        return null;
    }

    private function smtpConfigurationIssue(): ?string
    {
        $username = (string) config('mail.mailers.smtp.username', '');
        $password = (string) config('mail.mailers.smtp.password', '');
        $fromAddress = (string) config('mail.from.address', '');

        if ($username === '') {
            return 'MAIL_USERNAME is not set.';
        }

        if ($password === '') {
            return 'MAIL_PASSWORD is not set. Use a Gmail App Password (16 characters, no spaces).';
        }

        if ($fromAddress === '') {
            return 'MAIL_FROM_ADDRESS is not set. It must match MAIL_USERNAME for Gmail.';
        }

        if (strcasecmp($fromAddress, $username) !== 0) {
            return 'MAIL_FROM_ADDRESS must exactly match MAIL_USERNAME for Gmail SMTP.';
        }

        return null;
    }

    /**
     * @return array{
     *     mailer: string,
     *     configured: bool,
     *     issue: string|null,
     *     render_smtp_blocked_hint: string|null,
     *     from_address: string|null,
     *     host: string|null,
     *     port: int|string|null
     * }
     */
    public function status(): array
    {
        return [
            'mailer' => $this->mailer(),
            'configured' => $this->isRealDeliveryConfigured(),
            'issue' => $this->configurationIssue(),
            'render_smtp_blocked_hint' => $this->renderSmtpBlockedHint(),
            'from_address' => config('mail.from.address'),
            'host' => $this->mailer() === 'smtp' ? config('mail.mailers.smtp.host') : null,
            'port' => $this->mailer() === 'smtp' ? config('mail.mailers.smtp.port') : null,
        ];
    }

    public function logProductionMisconfiguration(): void
    {
        if (! app()->environment('production')) {
            return;
        }

        if ($issue = $this->configurationIssue()) {
            Log::warning('Mail is not configured for inbox delivery.', [
                'issue' => $issue,
                'mailer' => $this->mailer(),
                'render_smtp_blocked_hint' => $this->renderSmtpBlockedHint(),
            ]);
        }
    }
}
