<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use Database\Seeders\RolePermissionSeeder;
use Spatie\Permission\Models\Role;

class RoleCatalogService
{
    private static bool $ensured = false;

    public function ensureInstalled(): void
    {
        if (self::$ensured) {
            return;
        }

        $hasAdminRole = Role::query()
            ->where('guard_name', 'sanctum')
            ->where('name', UserRole::Admin->value)
            ->exists();

        if (! $hasAdminRole) {
            (new RolePermissionSeeder)->run();
        }

        self::$ensured = true;
    }
}
