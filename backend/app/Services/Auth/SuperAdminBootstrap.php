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

        $existing = User::query()->where('role', UserRole::SuperAdmin)->first();

        if ($existing) {
            if (config('app.super_admin_reset')) {
                self::resetFromConfig($existing);
            }

            return;
        }

        if (User::query()->where('email', self::email())->exists()) {
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
            'email' => self::email(),
            'password' => Hash::make($password),
            'role' => UserRole::SuperAdmin,
        ]);
    }

    public static function email(): string
    {
        $configured = strtolower(trim((string) config('app.super_admin_email', '')));

        return $configured !== '' ? $configured : self::EMAIL;
    }

    /**
     * One-off recovery (SUPER_ADMIN_RESET=true): apply SUPER_ADMIN_EMAIL and
     * SUPER_ADMIN_PASSWORD to the existing super admin and revoke its tokens.
     */
    private static function resetFromConfig(User $superAdmin): void
    {
        $password = self::initialPassword();

        if ($password === null) {
            Log::warning('Super admin reset skipped: SUPER_ADMIN_PASSWORD must be at least 12 characters in production.');

            return;
        }

        $email = self::email();

        if (User::query()->where('email', $email)->whereKeyNot($superAdmin->getKey())->exists()) {
            Log::warning('Super admin reset skipped: SUPER_ADMIN_EMAIL is already used by another account.');

            return;
        }

        $superAdmin->forceFill([
            'email' => $email,
            'password' => Hash::make($password),
        ])->save();

        $superAdmin->tokens()->delete();

        Log::warning('Super admin credentials were reset from the environment. Remove SUPER_ADMIN_RESET now.');
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
