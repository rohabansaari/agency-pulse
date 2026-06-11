<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $guard = 'sanctum';
        Permission::findOrCreate('screenshots.upload', $guard);

        $manager = Role::findByName('manager', $guard);
        if (! $manager->hasPermissionTo('screenshots.upload')) {
            $manager->givePermissionTo('screenshots.upload');
        }
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $manager = Role::findByName('manager', 'sanctum');
        $manager->revokePermissionTo('screenshots.upload');
    }
};
