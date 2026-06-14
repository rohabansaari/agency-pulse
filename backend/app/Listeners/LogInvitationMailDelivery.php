<?php

namespace App\Listeners;

use App\Services\Mail\InvitationDeliveryTracer;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\Events\MessageSent;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class LogInvitationMailDelivery
{
    public function __construct(
        private readonly InvitationDeliveryTracer $tracer,
    ) {}

    public function handleSending(MessageSending $event): void
    {
        if (! $this->isAccountInvitation($event->data)) {
            return;
        }

        $message = $event->message;

        if (! $message instanceof Email) {
            return;
        }

        $this->tracer->logMailerSendRequest([
            'mailer' => config('mail.default'),
            'from' => $this->formatAddressList($message->getFrom()),
            'to' => $this->formatAddressList($message->getTo()),
            'subject' => $message->getSubject(),
            'has_html' => $message->getHtmlBody() !== null,
            'has_text' => $message->getTextBody() !== null,
        ]);
    }

    public function handleSent(MessageSent $event): void
    {
        if (! $this->isAccountInvitation($event->data)) {
            return;
        }

        $message = $event->message;

        if (! $message instanceof Email) {
            return;
        }

        $responseBody = $message->getHeaders()->get('X-MailerSend-Body')?->getBodyAsString();
        $messageId = $message->getHeaders()->get('X-MailerSend-Message-Id')?->getBodyAsString();

        $this->tracer->logMailerSendResponse([
            'mailer' => config('mail.default'),
            'to' => $this->formatAddressList($message->getTo()),
            'subject' => $message->getSubject(),
            'mailersend_message_id' => $messageId,
            'mailersend_response_body' => $responseBody,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function isAccountInvitation(array $data): bool
    {
        return isset($data['setupUrl'], $data['role'], $data['user'], $data['organization']);
    }

    /**
     * @param  Address[]  $addresses
     * @return list<array{email: string, name: string|null}>
     */
    private function formatAddressList(array $addresses): array
    {
        return array_map(
            fn (Address $address) => [
                'email' => $address->getAddress(),
                'name' => $address->getName() ?: null,
            ],
            $addresses,
        );
    }
}
