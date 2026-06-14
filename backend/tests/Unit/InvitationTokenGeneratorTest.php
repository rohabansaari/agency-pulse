<?php

namespace Tests\Unit;

use App\Support\InvitationTokenGenerator;
use Tests\TestCase;

class InvitationTokenGeneratorTest extends TestCase
{
    public function test_generates_64_character_hex_token(): void
    {
        $token = InvitationTokenGenerator::create();

        $this->assertSame(64, strlen($token));
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
    }

    public function test_generates_unique_tokens(): void
    {
        $this->assertNotSame(
            InvitationTokenGenerator::create(),
            InvitationTokenGenerator::create(),
        );
    }
}
