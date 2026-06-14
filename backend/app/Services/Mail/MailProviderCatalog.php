<?php

namespace App\Services\Mail;

class MailProviderCatalog
{
    /**
     * @return list<array{
     *     id: string,
     *     name: string,
     *     mailer: string,
     *     recommended: bool,
     *     free_emails_per_month: string,
     *     free_daily_limit: string|null,
     *     unique_recipients: string,
     *     credit_card_required: bool,
     *     render_free_tier: bool,
     *     env: array<string, string>
     * }>
     */
    public function options(): array
    {
        return [
            [
                'id' => 'resend',
                'name' => 'Resend',
                'mailer' => 'resend',
                'recommended' => true,
                'free_emails_per_month' => '3,000',
                'free_daily_limit' => '100/day',
                'unique_recipients' => 'No cap on verified domain (volume limits only)',
                'credit_card_required' => false,
                'render_free_tier' => true,
                'env' => [
                    'MAIL_MAILER' => 'resend',
                    'RESEND_KEY' => 're_…',
                    'MAIL_FROM_ADDRESS' => 'noreply@yourdomain.com',
                    'MAIL_FROM_NAME' => 'AgencyPulse',
                ],
            ],
            [
                'id' => 'brevo',
                'name' => 'Brevo',
                'mailer' => 'brevo',
                'recommended' => true,
                'free_emails_per_month' => '~9,000 (300/day)',
                'free_daily_limit' => '300/day',
                'unique_recipients' => 'No cap on verified domain (volume limits only)',
                'credit_card_required' => false,
                'render_free_tier' => true,
                'env' => [
                    'MAIL_MAILER' => 'brevo',
                    'BREVO_API_KEY' => 'xkeysib-…',
                    'MAIL_FROM_ADDRESS' => 'noreply@yourdomain.com',
                    'MAIL_FROM_NAME' => 'AgencyPulse',
                ],
            ],
            [
                'id' => 'mailersend',
                'name' => 'MailerSend',
                'mailer' => 'mailersend',
                'recommended' => false,
                'free_emails_per_month' => '3,000',
                'free_daily_limit' => null,
                'unique_recipients' => 'Only 2 if sending from @mlsender.net trial domain',
                'credit_card_required' => false,
                'render_free_tier' => true,
                'env' => [
                    'MAIL_MAILER' => 'mailersend',
                    'MAILERSEND_API_KEY' => 'mlsn.…',
                    'MAIL_FROM_ADDRESS' => 'noreply@yourdomain.com',
                    'MAIL_FROM_NAME' => 'AgencyPulse',
                ],
            ],
        ];
    }

    public function recommendedMailer(): string
    {
        return 'resend';
    }
}
