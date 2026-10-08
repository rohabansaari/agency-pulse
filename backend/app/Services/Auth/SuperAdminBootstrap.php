<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\DatabaseMigration;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

final class SuperAdminBootstrap
{
    public const EMAIL = 'superadmin@gmail.com';

    public const NAME = 'Platform Super Admin';

    public static function ensureExists(): void
    {
        if (! Schema::hasTable('users') || ! self::organizationIdAllowsNull()) {
            return;
        }

        if (User::query()->where('role', UserRole::SuperAdmin)->exists()) {
            return;
        }

        if (User::query()->where('email', self::EMAIL)->exists()) {
            return;
        }

        $password = self::initialPassword();

        if ($password === null) {
            Log::warning('Platform super admin not created: set SUPER_ADMIN_PASSWORD (min 12 characters) in production.');

            return;
        }

        User::create([
            'organization_id' => null,
            'name' => self::NAME,
            'email' => self::EMAIL,
            'password' => Hash::make($password),
            'role' => UserRole::SuperAdmin,
        ]);
    }

    /**
     * Production never falls back to a well-known default password.
     */
    private static function initialPassword(): ?string
    {
        $configured = (string) config('app.super_admin_password', '');

        if (app()->environment('production')) {
            return strlen($configured) >= 12 ? $configured : null;
        }

        return $configured !== '' ? $configured : '12345678';
    }

    public static function organizationIdAllowsNull(): bool
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return false;
        }

        return DatabaseMigration::columnIsNullable('users', 'organization_id');
    }
}
