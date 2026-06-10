<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        (new RolePermissionSeeder)->run();
    }

    public function down(): void
    {
        // Permissions are additive; no rollback required.
    }
};
