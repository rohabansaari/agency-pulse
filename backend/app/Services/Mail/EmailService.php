<?php

namespace App\Services\Mail;

use App\Enums\UserRole;
use App\Mail\AccountInvitationMail;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailService
{
    private const RETRY_DELAY_SECONDS = 3;

    public function __construct(
        private readonly MailConfiguration $mailConfiguration,
    ) {}

    /**
     * @param  array{
     *     to: string,
     *     name: string,
     *     role: UserRole,
     *     inviteLink: string,
     *     companyName: string,
     *     user: User,
     *     organization: Organization,
     *     isAdminWelcome?: bool
     * }  $payload
     */
    public function sendInvitationEmail(array $payload): void
    {
        $recipient = strtolower(trim($payload['to']));

        if ($recipient === '' || ! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('A valid recipient email is required.');
        }

        $this->sendWithRetry(function () use ($payload, $recipient): void {
            Mail::mailer($this->mailConfiguration->mailer())
                ->to($recipient, $payload['name'])
                ->send(new AccountInvitationMail(
                    $payload['user'],
                    $payload['organization'],
                    $payload['inviteLink'],
                    $payload['role'],
                    $payload['isAdminWelcome'] ?? false,
                ));
        }, [
            'to' => $recipient,
            'role' => $payload['role']->value,
            'company' => $payload['companyName'],
            'mailer' => $this->mailConfiguration->mailer(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function sendWithRetry(callable $send, array $context): void
    {
        try {
            $send();
        } catch (\Throwable $firstFailure) {
            Log::warning('Invitation email send failed — retrying once.', [
                ...$context,
                'error' => $firstFailure->getMessage(),
                'retry_in_seconds' => self::RETRY_DELAY_SECONDS,
            ]);

            sleep(self::RETRY_DELAY_SECONDS);

            $send();
        }
    }
}
