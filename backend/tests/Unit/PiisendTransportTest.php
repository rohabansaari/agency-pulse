<?php

namespace Tests\Unit;

use App\Mail\Transport\PiisendTransport;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Tests\TestCase;

class PiisendTransportTest extends TestCase
{
    public function test_sends_email_via_piisend_api(): void
    {
        $requestBody = null;
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$requestBody) {
            $this->assertSame('POST', $method);
            $this->assertSame('https://api.piisend.com/api/v1/emails', $url);

            $authHeader = $options['normalized_headers']['authorization'][0] ?? '';
            $this->assertSame('Bearer pii_test_key', $authHeader);

            $requestBody = $options['body'] ?? null;

            return new MockResponse(json_encode([
                'id' => 'em_test_123',
                'status' => 'queued',
            ]), ['http_code' => 202]);
        });

        $transport = new PiisendTransport('pii_test_key', $client);

        $email = (new Email)
            ->from(new Address('noreply@shared.piisend.com', 'AgencyPulse'))
            ->to('invite@example.com')
            ->subject('Set your password')
            ->html('<p>Welcome</p>')
            ->text('Welcome');

        $transport->send($email, Envelope::create($email));

        $this->assertIsString($requestBody);
        $payload = json_decode($requestBody, true);

        $this->assertSame(['invite@example.com'], $payload['to']);
        $this->assertSame('Set your password', $payload['subject']);
        $this->assertSame('<p>Welcome</p>', $payload['html']);
        $this->assertSame('Welcome', $payload['text']);
        $this->assertSame('noreply@shared.piisend.com', $payload['from_']);
        $this->assertSame('AgencyPulse', $payload['from_name']);
    }

    public function test_raises_when_piisend_api_returns_error(): void
    {
        $client = new MockHttpClient(new MockResponse('{"error":"invalid key"}', ['http_code' => 401]));
        $transport = new PiisendTransport('bad_key', $client);

        $email = (new Email)
            ->to('invite@example.com')
            ->subject('Test')
            ->text('Hello');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Piisend API error (401)');

        $transport->send($email, Envelope::create($email));
    }
}
