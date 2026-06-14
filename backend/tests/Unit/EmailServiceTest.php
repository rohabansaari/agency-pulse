<?php

namespace Tests\Unit;

use App\Enums\UserRole;
use App\Mail\AccountInvitationMail;
use App\Models\Organization;
use App\Models\User;
use App\Services\Mail\EmailService;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailServiceTest extends TestCase
{
    public function test_send_invitation_email_retries_once_after_failure(): void
    {
        Mail::shouldReceive('mailer')->twice()->andReturnSelf();
        Mail::shouldReceive('to')->twice()->andReturnSelf();
        Mail::shouldReceive('send')
            ->twice()
            ->withArgs(fn ($mailable) => $mailable instanceof AccountInvitationMail)
            ->andReturnUsing(function () use (&$calls) {
                $calls = ($calls ?? 0) + 1;
                if ($calls === 1) {
                    throw new \RuntimeException('Temporary SMTP failure');
                }
            });

        $organization = Organization::factory()->make(['name' => 'Acme']);
        $user = User::factory()->make([
            'name' => 'John Doe',
            'email' => 'john@example.com',
        ]);

        app(EmailService::class)->sendInvitationEmail([
            'to' => 'john@example.com',
            'name' => 'John Doe',
            'role' => UserRole::Manager,
            'inviteLink' => 'https://app.example.com/set-password?token=abc',
            'companyName' => 'Acme',
            'user' => $user,
            'organization' => $organization,
        ]);

        $this->assertSame(2, $calls ?? 0);
    }

    public function test_send_invitation_email_rejects_invalid_recipient(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        app(EmailService::class)->sendInvitationEmail([
            'to' => 'not-an-email',
            'name' => 'John Doe',
            'role' => UserRole::Employee,
            'inviteLink' => 'https://app.example.com/set-password?token=abc',
            'companyName' => 'Acme',
            'user' => User::factory()->make(),
            'organization' => Organization::factory()->make(),
        ]);
    }
}
