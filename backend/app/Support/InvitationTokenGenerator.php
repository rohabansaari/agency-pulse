<?php

namespace App\Support;

class InvitationTokenGenerator
{
    /**
     * Cryptographically secure token (32 random bytes → 64 hex characters).
     */
    public static function create(): string
    {
        return bin2hex(random_bytes(32));
    }
}
