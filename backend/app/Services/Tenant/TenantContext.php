<?php

namespace App\Services\Tenant;

use App\Models\Organization;

final class TenantContext
{
    private static ?Organization $organization = null;

    public static function set(Organization $organization): void
    {
        self::$organization = $organization;
    }

    public static function has(): bool
    {
        return self::$organization !== null;
    }

    public static function id(): int
    {
        return self::get()->id;
    }

    public static function get(): Organization
    {
        if (self::$organization === null) {
            throw new \RuntimeException('Tenant context has not been resolved.');
        }

        return self::$organization;
    }

    public static function forget(): void
    {
        self::$organization = null;
    }
}
