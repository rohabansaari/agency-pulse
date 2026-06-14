<?php

namespace App\Jobs;

use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\User;
use App\Services\Mail\EmailService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendInvitationEmailJob implements ShouldQueue
{
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;

    public int $backoff = 3;

    public function __construct(
        public User $user,
        public Organization $organization,
        public string $plainToken,
        public UserRole $role,
        public bool $isAdminWelcome = false,
    ) {}

    public function handle(EmailService $emailService): void
    {
        $frontend = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/');
        $inviteLink = $frontend.'/set-password?token='.urlencode($this->plainToken);

        $emailService->sendInvitationEmail([
            'to' => (string) $this->user->email,
            'name' => (string) $this->user->name,
            'role' => $this->role,
            'inviteLink' => $inviteLink,
            'companyName' => (string) $this->organization->name,
            'user' => $this->user,
            'organization' => $this->organization,
            'isAdminWelcome' => $this->isAdminWelcome,
        ]);
    }
}
