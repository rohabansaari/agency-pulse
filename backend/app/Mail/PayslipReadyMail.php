<?php

namespace App\Mail;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** "Your payslip is ready": a link to the payslip, never salary figures. */
class PayslipReadyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Organization $organization,
        public string $periodLabel,
        public string $payslipUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your payslip for {$this->periodLabel} is ready",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.payslip-ready',
            text: 'emails.payslip-ready-text',
        );
    }
}
