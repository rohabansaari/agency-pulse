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

        try {
            Mail::to($recipient, $payload['name'])
                ->send(new AccountInvitationMail(
                    $payload['user'],
                    $payload['organization'],
                    $payload['inviteLink'],
                    $payload['role'],
                    $payload['isAdminWelcome'] ?? false,
                ));
        } catch (\Throwable $exception) {
            Log::warning('Invitation email send failed.', [
                'to' => $recipient,
                'role' => $payload['role']->value,
                'company' => $payload['companyName'],
                'mailer' => $this->mailConfiguration->mailer(),
                'error' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }
}
