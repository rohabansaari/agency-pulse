<?php

namespace App\Mail;

use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Organization $organization,
        public string $setupUrl,
        public UserRole $role,
        public bool $isAdminWelcome = false,
    ) {}

    public function envelope(): Envelope
    {
        $roleLabel = $this->role->label();

        return new Envelope(
            subject: "You're invited to join AgencyPulse as {$roleLabel}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.account-invitation',
            text: 'emails.account-invitation-text',
            with: [
                'isAdminWelcome' => $this->isAdminWelcome,
                'roleLabel' => $this->role->label(),
            ],
        );
    }
}
