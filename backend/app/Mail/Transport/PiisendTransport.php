<?php

namespace App\Mail\Transport;

use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class PiisendTransport extends AbstractTransport
{
    private const API_URL = 'https://api.piisend.com/api/v1/emails';

    public function __construct(
        private readonly string $apiKey,
        private readonly ?HttpClientInterface $client = null,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());
        $payload = $this->buildPayload($email);

        $client = $this->client ?? \Symfony\Component\HttpClient\HttpClient::create();

        $response = $client->request('POST', self::API_URL, [
            'headers' => [
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'json' => $payload,
        ]);

        $statusCode = $response->getStatusCode();
        if ($statusCode >= 400) {
            throw new \RuntimeException(sprintf(
                'Piisend API error (%d): %s',
                $statusCode,
                $response->getContent(false),
            ));
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(Email $email): array
    {
        $payload = [
            'to' => $this->formatAddresses($email->getTo()),
            'subject' => $email->getSubject() ?? '',
        ];

        $htmlBody = $email->getHtmlBody();
        if (is_string($htmlBody) && $htmlBody !== '') {
            $payload['html'] = $htmlBody;
        }

        $textBody = $email->getTextBody();
        if (is_string($textBody) && $textBody !== '') {
            $payload['text'] = $textBody;
        }

        if ($payload['html'] ?? $payload['text'] ?? null) {
            // continue
        } else {
            $payload['text'] = '';
        }

        $from = $email->getFrom();
        if ($from !== []) {
            $sender = $from[0];
            $payload['from_'] = $sender->getAddress();

            $name = $sender->getName();
            if ($name !== '') {
                $payload['from_name'] = $name;
            }
        }

        $cc = $this->formatAddresses($email->getCc());
        if ($cc !== []) {
            $payload['cc'] = $cc;
        }

        $bcc = $this->formatAddresses($email->getBcc());
        if ($bcc !== []) {
            $payload['bcc'] = $bcc;
        }

        $replyTo = $email->getReplyTo();
        if ($replyTo !== []) {
            $payload['reply_to'] = $replyTo[0]->getAddress();
        }

        return $payload;
    }

    /**
     * @param  list<Address>  $addresses
     * @return list<string>
     */
    private function formatAddresses(array $addresses): array
    {
        return array_values(array_map(
            static fn (Address $address): string => $address->getAddress(),
            $addresses,
        ));
    }

    public function __toString(): string
    {
        return 'piisend';
    }
}
