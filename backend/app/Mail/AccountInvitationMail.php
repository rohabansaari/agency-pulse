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
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->role === UserRole::Admin
            ? 'Welcome to AgencyPulse — set up your admin account'
            : 'You are invited to '.$this->organization->name.' on AgencyPulse';

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.account-invitation',
            text: 'emails.account-invitation-text',
            with: [
                'isAdminWelcome' => $this->role === UserRole::Admin,
            ],
        );
    }
}
