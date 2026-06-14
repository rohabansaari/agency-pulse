<?php

namespace App\Services\Auth;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Mail\AdminWelcomeMail;
use App\Mail\UserInvitationMail;
use App\Models\InvitationToken;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Mail\MailConfiguration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InvitationService
{
    public const TOKEN_TTL_HOURS = 24;

    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync,
        private readonly MailConfiguration $mailConfiguration,
    ) {}

    public function createPlaceholderPassword(): string
    {
        return Hash::make(Str::random(64));
    }

    /**
     * @return array{user: User, membership: OrganizationMember}
     */
    public function createPendingMember(
        Organization $organization,
        string $name,
        string $email,
        UserRole $role,
    ): array {
        if (User::query()->where('email', $email)->exists()) {
            $existing = User::query()->where('email', $email)->first();
            $alreadyMember = OrganizationMember::query()
                ->where('organization_id', $organization->id)
                ->where('user_id', $existing->id)
                ->exists();

            if ($alreadyMember) {
                throw ValidationException::withMessages([
                    'email' => ['This email is already a member of the organization.'],
                ]);
            }

            throw ValidationException::withMessages([
                'email' => ['This email is already registered.'],
            ]);
        }

        $user = User::create([
            'organization_id' => $organization->id,
            'name' => $name,
            'email' => $email,
            'password' => $this->createPlaceholderPassword(),
            'role' => $role,
        ]);

        $membership = OrganizationMember::create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'role' => $role,
            'status' => OrganizationMemberStatus::Invited,
            'invited_at' => now(),
            'joined_at' => null,
        ]);

        $this->membershipRoleSync->syncFromMembership($membership);

        return [
            'user' => $user,
            'membership' => $membership->load('user'),
        ];
    }

    public function sendInvitation(User $user, Organization $organization, bool $isAdminWelcome = false): string
    {
        $plainToken = $this->issueToken($user, $organization, resent: false);
        $this->trySendInvitationEmail($user, $organization, $plainToken, $isAdminWelcome);

        return $plainToken;
    }

    /**
     * @return array{user: User, membership: OrganizationMember, plain_token: string, invitation_email_sent: bool}
     */
    public function createInvitedMember(
        Organization $organization,
        string $name,
        string $email,
        UserRole $role,
        bool $isAdminWelcome = false,
    ): array {
        $bundle = DB::transaction(function () use ($organization, $name, $email, $role) {
            $pending = $this->createPendingMember($organization, $name, $email, $role);
            $plainToken = $this->issueToken($pending['user'], $organization, resent: false);

            return [
                'pending' => $pending,
                'plain_token' => $plainToken,
            ];
        });

        $emailSent = $this->trySendInvitationEmail(
            $bundle['pending']['user'],
            $organization,
            $bundle['plain_token'],
            $isAdminWelcome,
        );

        return [
            'user' => $bundle['pending']['user'],
            'membership' => $bundle['pending']['membership'],
            'plain_token' => $bundle['plain_token'],
            'invitation_email_sent' => $emailSent,
        ];
    }

    public function issueToken(User $user, Organization $organization, bool $resent): string
    {
        InvitationToken::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $organization->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $plainToken = Str::random(64);

        InvitationToken::create([
            'user_id' => $user->id,
            'organization_id' => $organization->id,
            'token_hash' => hash('sha256', $plainToken),
            'sent_at' => now(),
            'expires_at' => now()->addHours(self::TOKEN_TTL_HOURS),
            'resent_count' => $resent ? 1 : 0,
        ]);

        return $plainToken;
    }

    public function sendInvitationEmail(
        User $user,
        Organization $organization,
        string $plainToken,
        bool $isAdminWelcome,
    ): void {
        $setupUrl = $this->setupPasswordUrl($plainToken);
        $mailable = $isAdminWelcome
            ? new AdminWelcomeMail($user, $organization, $setupUrl)
            : new UserInvitationMail($user, $organization, $setupUrl);

        Mail::to($user->email)->send($mailable);
    }

    public function trySendInvitationEmail(
        User $user,
        Organization $organization,
        string $plainToken,
        bool $isAdminWelcome = false,
    ): bool {
        if ($issue = $this->mailConfiguration->configurationIssue()) {
            Log::error('Invitation email not sent — mail misconfigured.', [
                'user_id' => $user->id,
                'organization_id' => $organization->id,
                'email' => $user->email,
                'issue' => $issue,
                'mailer' => $this->mailConfiguration->mailer(),
            ]);

            return false;
        }

        try {
            $this->sendInvitationEmail($user, $organization, $plainToken, $isAdminWelcome);

            return true;
        } catch (\Throwable $exception) {
            Log::error('Invitation email failed to send.', [
                'user_id' => $user->id,
                'organization_id' => $organization->id,
                'email' => $user->email,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    public function mailDeliveryIssue(): ?string
    {
        return $this->mailConfiguration->configurationIssue();
    }

    public function setupPasswordUrl(string $plainToken): string
    {
        $frontend = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/');

        return $frontend.'/set-password?token='.urlencode($plainToken);
    }

    public function findValidToken(string $plainToken): ?InvitationToken
    {
        $token = InvitationToken::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->with(['user', 'organization'])
            ->first();

        if (! $token || ! $token->isValid()) {
            return null;
        }

        return $token;
    }

    /**
     * @return array{name: string, email: string, organization_name: string, expires_at: string}
     */
    public function previewInvitation(string $plainToken): array
    {
        $token = $this->findValidToken($plainToken);

        if (! $token) {
            throw ValidationException::withMessages([
                'token' => ['This invitation link is invalid or has expired.'],
            ]);
        }

        return [
            'name' => $token->user->name,
            'email' => $token->user->email,
            'organization_name' => $token->organization->name,
            'expires_at' => $token->expires_at->toIso8601String(),
        ];
    }

    public function acceptInvitation(string $plainToken, string $password): User
    {
        $token = $this->findValidToken($plainToken);

        if (! $token) {
            throw ValidationException::withMessages([
                'token' => ['This invitation link is invalid or has expired.'],
            ]);
        }

        return DB::transaction(function () use ($token, $password) {
            $user = $token->user;
            $membership = OrganizationMember::query()
                ->where('user_id', $user->id)
                ->where('organization_id', $token->organization_id)
                ->firstOrFail();

            $user->forceFill([
                'password' => Hash::make($password),
            ])->save();

            $membership->update([
                'status' => OrganizationMemberStatus::Active,
                'joined_at' => now(),
            ]);

            $token->update(['used_at' => now()]);

            InvitationToken::query()
                ->where('user_id', $user->id)
                ->where('organization_id', $token->organization_id)
                ->whereNull('used_at')
                ->where('id', '!=', $token->id)
                ->update(['used_at' => now()]);

            return $user->fresh();
        });
    }

    public function resend(User $user, Organization $organization, bool $isAdminWelcome = false): InvitationToken
    {
        $membership = OrganizationMember::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $organization->id)
            ->firstOrFail();

        if ($membership->status !== OrganizationMemberStatus::Invited) {
            throw ValidationException::withMessages([
                'user' => ['Invitations can only be resent for pending members.'],
            ]);
        }

        $membership->update(['invited_at' => now()]);

        $previousCount = InvitationToken::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $organization->id)
            ->max('resent_count') ?? 0;

        InvitationToken::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $organization->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $plainToken = Str::random(64);

        $token = InvitationToken::create([
            'user_id' => $user->id,
            'organization_id' => $organization->id,
            'token_hash' => hash('sha256', $plainToken),
            'sent_at' => now(),
            'expires_at' => now()->addHours(self::TOKEN_TTL_HOURS),
            'resent_count' => $previousCount + 1,
        ]);

        $this->trySendInvitationEmail($user, $organization, $plainToken, $isAdminWelcome);

        return $token;
    }

    public function latestTokenForMember(OrganizationMember $member): ?InvitationToken
    {
        return InvitationToken::query()
            ->where('user_id', $member->user_id)
            ->where('organization_id', $member->organization_id)
            ->latest('id')
            ->first();
    }
}
