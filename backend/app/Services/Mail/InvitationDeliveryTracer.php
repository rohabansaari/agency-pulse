<?php

namespace App\Services\Mail;

use App\Models\InvitationToken;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class InvitationDeliveryTracer
{
    /**
     * @return array{
     *     user_id: int,
     *     membership_id: int,
     *     organization_id: int,
     *     email: string,
     *     role: string,
     *     membership_status: string
     * }
     */
    public function logMemberCreated(User $user, OrganizationMember $membership): array
    {
        $context = [
            'user_id' => $user->id,
            'membership_id' => $membership->id,
            'organization_id' => $membership->organization_id,
            'email' => $user->email,
            'role' => $user->role?->value ?? (string) $user->role,
            'membership_status' => $membership->status->value,
        ];

        Log::info('Invitation flow: employee record created.', $context);

        return $context;
    }

    /**
     * @return array{
     *     transaction_committed: bool,
     *     invitation_token_exists: bool,
     *     invitation_token_id: int|null,
     *     token_sent_at: string|null,
     *     token_expires_at: string|null
     * }
     */
    public function logTransactionCommitted(User $user, Organization $organization): array
    {
        $token = InvitationToken::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $organization->id)
            ->whereNull('used_at')
            ->latest('id')
            ->first();

        $context = [
            'transaction_committed' => true,
            'invitation_token_exists' => $token !== null,
            'invitation_token_id' => $token?->id,
            'token_sent_at' => $token?->sent_at?->toIso8601String(),
            'token_expires_at' => $token?->expires_at?->toIso8601String(),
            'user_id' => $user->id,
            'organization_id' => $organization->id,
        ];

        Log::info('Invitation flow: database transaction committed before mail dispatch.', $context);

        return $context;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function logMailDispatchAttempt(array $context): void
    {
        Log::info('Invitation flow: AccountInvitationMail dispatch starting.', $context);
    }

    /**
     * @param  array<string, mixed>  $request
     */
    public function logMailerSendRequest(array $request): void
    {
        Log::info('Invitation flow: MailerSend API request.', $request);
    }

    /**
     * @param  array<string, mixed>  $response
     */
    public function logMailerSendResponse(array $response): void
    {
        Log::info('Invitation flow: MailerSend API response.', $response);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function logMailDispatchSuccess(array $context): void
    {
        Log::info('Invitation flow: AccountInvitationMail dispatch succeeded.', $context);
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array{
     *     exception_class: string,
     *     exception_message: string,
     *     exception_code: int|string,
     *     mailersend_response: string|null,
     *     stack_trace: string
     * }
     */
    public function logMailDispatchFailure(\Throwable $exception, array $context): array
    {
        $failure = [
            'exception_class' => $exception::class,
            'exception_message' => $exception->getMessage(),
            'exception_code' => $exception->getCode(),
            'mailersend_response' => $this->extractMailerSendResponse($exception),
            'stack_trace' => $exception->getTraceAsString(),
        ];

        Log::error('Invitation flow: AccountInvitationMail dispatch failed.', array_merge($context, $failure));

        return $failure;
    }

    public function extractMailerSendResponse(\Throwable $exception): ?string
    {
        $message = $exception->getMessage();

        if ($message === '') {
            return null;
        }

        if (str_starts_with(trim($message), '{') || str_starts_with(trim($message), '[')) {
            return $message;
        }

        if (preg_match('/(\{.*\}|\[.*\])/s', $message, $matches)) {
            return $matches[1];
        }

        return $message;
    }

    /**
     * @param  array<string, mixed>  $transaction
     * @param  array<string, mixed>  $mail
     * @return array<string, mixed>
     */
    public function buildDeliveryMeta(array $transaction, array $mail): array
    {
        return array_merge($transaction, $mail);
    }
}
