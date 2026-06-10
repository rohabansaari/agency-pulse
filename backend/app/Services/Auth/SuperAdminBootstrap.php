<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

final class SuperAdminBootstrap
{
    public const EMAIL = 'superadmin@gmail.com';

    public const NAME = 'Platform Super Admin';

    public static function ensureExists(): void
    {
        if (User::query()->where('role', UserRole::SuperAdmin)->exists()) {
            return;
        }

        if (User::query()->where('email', self::EMAIL)->exists()) {
            return;
        }

        User::create([
            'organization_id' => null,
            'name' => self::NAME,
            'email' => self::EMAIL,
            'password' => Hash::make('12345678'),
            'role' => UserRole::SuperAdmin,
        ]);
    }
}
