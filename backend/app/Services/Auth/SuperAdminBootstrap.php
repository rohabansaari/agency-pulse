<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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

        User::create([
            'organization_id' => null,
            'name' => self::NAME,
            'email' => self::EMAIL,
            'password' => Hash::make('12345678'),
            'role' => UserRole::SuperAdmin,
        ]);
    }

    public static function organizationIdAllowsNull(): bool
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return false;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            $result = DB::selectOne("
                SELECT IS_NULLABLE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'organization_id'
            ");

            return ($result->IS_NULLABLE ?? 'NO') === 'YES';
        }

        if ($driver === 'sqlite') {
            $columns = DB::select('PRAGMA table_info(users)');
            foreach ($columns as $column) {
                if (($column->name ?? null) === 'organization_id') {
                    return (int) ($column->notnull ?? 1) === 0;
                }
            }

            return false;
        }

        return true;
    }
}
