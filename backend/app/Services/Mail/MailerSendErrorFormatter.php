<?php

namespace App\Services\Mail;

class MailerSendErrorFormatter
{
    public function format(\Throwable $exception): string
    {
        $message = $exception->getMessage();
        $code = $this->extractErrorCode($message);

        return match ($code) {
            'MS42225' => 'MailerSend trial sender domain allows only 2 unique recipients. Set MAIL_FROM_ADDRESS to an address on your verified domain (not @mlsender.net), redeploy, then resend from Employees.',
            'MS42222' => 'MailerSend trial sender domain reached its email quota. Set MAIL_FROM_ADDRESS to your verified domain, redeploy, then resend from Employees.',
            'MS42207' => 'The sender domain is not verified in MailerSend. Verify your domain and set MAIL_FROM_ADDRESS to e.g. noreply@yourdomain.com.',
            'MS42212' => 'MailerSend rejected this recipient. Verify your sending domain in MailerSend and resend the invitation.',
            default => $this->formatFromMessage($message),
        };
    }

    public function extractErrorCode(string $message): ?string
    {
        if (preg_match('/\b(MS\d{5})\b/', $message, $matches)) {
            return $matches[1];
        }

        $decoded = json_decode($message, true);
        if (is_array($decoded)) {
            $code = $decoded['code'] ?? $decoded['error']['code'] ?? null;
            if (is_string($code) && preg_match('/^MS\d{5}$/', $code)) {
                return $code;
            }

            foreach ($decoded['errors'] ?? [] as $error) {
                if (! is_array($error)) {
                    continue;
                }

                $nestedCode = $error['code'] ?? null;
                if (is_string($nestedCode) && preg_match('/^MS\d{5}$/', $nestedCode)) {
                    return $nestedCode;
                }
            }
        }

        if (preg_match('/"(?:code|error_code)"\s*:\s*"(MS\d{5})"/', $message, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function formatFromMessage(string $message): string
    {
        if (str_contains($message, 'MS42225') || str_contains($message, 'trial domain unique recipients limit')) {
            return 'MailerSend trial sender domain allows only 2 unique recipients. Set MAIL_FROM_ADDRESS to an address on your verified domain (not @mlsender.net), redeploy, then resend from Employees.';
        }

        if (str_contains($message, 'MS42207') || str_contains($message, 'from.email domain must be verified')) {
            return 'The sender domain is not verified in MailerSend. Verify your domain and set MAIL_FROM_ADDRESS to e.g. noreply@yourdomain.com.';
        }

        if (str_contains($message, 'MS42212')) {
            return 'MailerSend rejected this recipient. Verify your sending domain in MailerSend and resend the invitation.';
        }

        return $message;
    }
}
