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
            return 'MAIL_MAILER must be smtp in production (currently "'.$mailer.'"). Log/array drivers do not deliver to inboxes.';
        }

        if ($mailer !== 'smtp') {
            return null;
        }

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
            'from_address' => config('mail.from.address'),
            'host' => config('mail.mailers.smtp.host'),
            'port' => config('mail.mailers.smtp.port'),
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
            ]);
        }
    }
}
