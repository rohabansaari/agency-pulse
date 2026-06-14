<?php

namespace App\Services\Mail;

use Illuminate\Support\Facades\Log;

class MailConfiguration
{
    /** @var list<string> */
    private const REAL_DELIVERY_MAILERS = ['piisend', 'resend', 'brevo', 'mailersend', 'smtp', 'ses', 'postmark'];

    /** @var list<string> */
    private const PLACEHOLDER_FROM_ADDRESSES = [
        'hello@example.com',
        'example@example.com',
        'noreply@example.com',
    ];

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
            return 'MAIL_MAILER must be piisend (no domain), resend, brevo, mailersend, or smtp on a paid host. Currently "'.$mailer.'" only writes to logs.';
        }

        return match ($mailer) {
            'piisend' => $this->piisendConfigurationIssue(),
            'resend' => $this->resendConfigurationIssue(),
            'brevo' => $this->brevoConfigurationIssue(),
            'mailersend' => $this->mailersendConfigurationIssue(),
            'smtp' => $this->smtpConfigurationIssue(),
            default => null,
        };
    }

    public function renderSmtpBlockedHint(): ?string
    {
        if ($this->mailer() !== 'smtp') {
            return null;
        }

        return 'Render free tier blocks outbound SMTP (ports 465/587). Use MAIL_MAILER=piisend with PIISEND_API_KEY (no domain), upgrade the API to Starter for Gmail SMTP, or use Resend/Brevo with a verified domain.';
    }

    public function fromAddress(): ?string
    {
        $fromAddress = config('mail.from.address');

        if (! is_string($fromAddress)) {
            return null;
        }

        $fromAddress = strtolower(trim($fromAddress));

        return $fromAddress === '' ? null : $fromAddress;
    }

    public function isTrialMailerSendSender(): bool
    {
        $fromAddress = $this->fromAddress();

        if ($fromAddress === null) {
            return false;
        }

        $domain = substr(strrchr($fromAddress, '@') ?: '', 1);

        return $domain === 'mlsender.net' || str_ends_with($domain, '.mlsender.net');
    }

    public function isGmailSender(): bool
    {
        $fromAddress = $this->fromAddress();

        return $fromAddress !== null && str_ends_with($fromAddress, '@gmail.com');
    }

    public function brevoSenderVerificationHint(): ?string
    {
        if ($this->mailer() !== 'brevo' || ! $this->isGmailSender()) {
            return null;
        }

        return 'Verify agencypulse.notifications@gmail.com in Brevo → Senders, Domains & IPs → Senders → enter the 6-digit code Brevo emails you. Gmail cannot be domain-authenticated; single-sender verification is required.';
    }

    private function piisendConfigurationIssue(): ?string
    {
        $apiKey = (string) config('services.piisend.key', '');

        if ($apiKey === '') {
            return 'PIISEND_API_KEY is not set. Sign up at piisend.com → API → Keys → create a key with emails:send scope.';
        }

        return null;
    }

    private function mailersendConfigurationIssue(): ?string
    {
        $apiKey = (string) config('services.mailersend.key', '');
        $fromAddress = $this->fromAddress();

        if ($apiKey === '') {
            return 'MAILERSEND_API_KEY is not set. Create an API token in the MailerSend dashboard.';
        }

        if ($fromAddress === null) {
            return 'MAIL_FROM_ADDRESS is not set. Use an address on a domain you verified in MailerSend (e.g. noreply@yourdomain.com).';
        }

        if (in_array($fromAddress, self::PLACEHOLDER_FROM_ADDRESSES, true)) {
            return 'MAIL_FROM_ADDRESS is still a placeholder. Set it to an address on your verified MailerSend domain (e.g. noreply@yourdomain.com).';
        }

        if (str_ends_with($fromAddress, '@gmail.com')) {
            return 'Gmail addresses cannot be used as the sender with MailerSend. Verify your domain in MailerSend and set MAIL_FROM_ADDRESS to e.g. noreply@yourdomain.com.';
        }

        if ($this->isTrialMailerSendSender()) {
            return 'MAIL_FROM_ADDRESS uses MailerSend\'s trial domain (@mlsender.net), which only allows 2 unique recipients. Set MAIL_FROM_ADDRESS to your verified domain (e.g. noreply@yourdomain.com) and redeploy.';
        }

        return null;
    }

    private function brevoConfigurationIssue(): ?string
    {
        $apiKey = (string) config('services.brevo.key', '');
        $fromAddress = $this->fromAddress();

        if ($apiKey === '') {
            return 'BREVO_API_KEY is not set. Create an HTTP API key at app.brevo.com → SMTP & API → API keys (starts with xkeysib-).';
        }

        if (str_starts_with($apiKey, 'xsmtpsib-')) {
            return 'BREVO_API_KEY is an SMTP key (xsmtpsib-). Render uses the HTTP API — create an API key (xkeysib-…) under API keys, not SMTP keys. SMTP ports are blocked on Render free tier anyway.';
        }

        if ($fromAddress === null) {
            return 'MAIL_FROM_ADDRESS is not set. Use a sender you verified in Brevo (e.g. agencypulse.notifications@gmail.com).';
        }

        if (in_array($fromAddress, self::PLACEHOLDER_FROM_ADDRESSES, true)) {
            return 'MAIL_FROM_ADDRESS is still a placeholder. Set it to your verified Brevo sender address.';
        }

        return null;
    }

    private function resendConfigurationIssue(): ?string
    {
        $apiKey = (string) config('services.resend.key', '');
        $fromAddress = $this->fromAddress();

        if ($apiKey === '') {
            return 'RESEND_KEY is not set. Create a free API key at resend.com/api-keys.';
        }

        if ($fromAddress === null) {
            return 'MAIL_FROM_ADDRESS is not set. Use an address on a domain you verified in Resend (e.g. noreply@yourdomain.com).';
        }

        if (in_array($fromAddress, self::PLACEHOLDER_FROM_ADDRESSES, true)) {
            return 'MAIL_FROM_ADDRESS is still a placeholder. Set it to an address on your verified Resend domain (e.g. noreply@yourdomain.com).';
        }

        if (str_ends_with($fromAddress, '@gmail.com')) {
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
            return 'EMAIL_USER (or MAIL_USERNAME) is not set. Use agencypulse.notifications@gmail.com with a Gmail App Password.';
        }

        if ($password === '') {
            return 'EMAIL_PASS (or MAIL_PASSWORD) is not set. Use a Gmail App Password (16 characters, no spaces).';
        }

        if ($fromAddress === '') {
            return 'MAIL_FROM_ADDRESS is not set. Set it to the same Gmail address as EMAIL_USER.';
        }

        if (strcasecmp($fromAddress, $username) !== 0) {
            return 'MAIL_FROM_ADDRESS must exactly match EMAIL_USER for Gmail SMTP.';
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
     *     using_trial_mailersend_sender: bool,
     *     using_gmail_sender: bool,
     *     brevo_sender_verification_hint: string|null,
     *     recommended_mailer: string,
     *     providers: list<array<string, mixed>>,
     *     host: string|null,
     *     port: int|string|null
     * }
     */
    public function status(): array
    {
        $catalog = app(MailProviderCatalog::class);

        return [
            'mailer' => $this->mailer(),
            'configured' => $this->isRealDeliveryConfigured(),
            'issue' => $this->configurationIssue(),
            'render_smtp_blocked_hint' => $this->renderSmtpBlockedHint(),
            'from_address' => $this->fromAddress(),
            'using_trial_mailersend_sender' => $this->isTrialMailerSendSender(),
            'using_gmail_sender' => $this->isGmailSender(),
            'brevo_sender_verification_hint' => $this->brevoSenderVerificationHint(),
            'recommended_mailer' => $catalog->recommendedMailer(),
            'providers' => $catalog->options(),
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
