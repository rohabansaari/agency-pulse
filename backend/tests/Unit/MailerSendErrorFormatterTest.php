<?php

namespace Tests\Unit;

use App\Services\Mail\MailerSendErrorFormatter;
use Tests\TestCase;

class MailerSendErrorFormatterTest extends TestCase
{
    public function test_formats_ms42225_with_actionable_sender_domain_guidance(): void
    {
        $message = app(MailerSendErrorFormatter::class)->format(
            new \RuntimeException('MS42225 You have reached the trial domain unique recipients limit.'),
        );

        $this->assertStringContainsString('verified domain', $message);
        $this->assertStringContainsString('mlsender.net', $message);
    }

    public function test_extracts_error_code_from_json_payload(): void
    {
        $formatter = app(MailerSendErrorFormatter::class);

        $this->assertSame(
            'MS42207',
            $formatter->extractErrorCode('{"message":"Domain must be verified","code":"MS42207"}'),
        );
    }

    public function test_formats_ms42207_from_json_payload(): void
    {
        $message = app(MailerSendErrorFormatter::class)->format(
            new \RuntimeException('{"message":"The from.email domain must be verified","code":"MS42207"}'),
        );

        $this->assertStringContainsString('sender domain is not verified', $message);
    }
}
