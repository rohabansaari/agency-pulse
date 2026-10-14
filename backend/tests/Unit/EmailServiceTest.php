<?php

namespace Tests\Unit;

use App\Enums\UserRole;
use App\Mail\AccountInvitationMail;
use App\Models\Organization;
use App\Models\User;
use App\Services\Mail\EmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_send_invitation_email_sends_once_and_rethrows_failure(): void
    {
        // Delivery is attempted once (no blocking retry); admins can resend from the UI.
        Mail::shouldReceive('to')->once()->andReturnSelf();
        Mail::shouldReceive('send')
            ->once()
            ->withArgs(fn ($mailable) => $mailable instanceof AccountInvitationMail)
            ->andThrow(new \RuntimeException('Temporary SMTP failure'));
        Log::spy();

        $organization = Organization::factory()->make(['name' => 'Acme']);
        $user = User::factory()->make([
            'name' => 'John Doe',
            'email' => 'john@example.com',
        ]);

        try {
            app(EmailService::class)->sendInvitationEmail([
                'to' => 'john@example.com',
                'name' => 'John Doe',
                'role' => UserRole::Manager,
                'inviteLink' => 'https://app.example.com/set-password?token=abc',
                'companyName' => 'Acme',
                'user' => $user,
                'organization' => $organization,
            ]);
            $this->fail('Expected the delivery failure to be rethrown.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Temporary SMTP failure', $exception->getMessage());
        }

        Log::shouldHaveReceived('warning')
            ->once()
            ->withArgs(fn ($message, $context) => $message === 'Invitation email send failed.'
                && $context['to'] === 'john@example.com');
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
