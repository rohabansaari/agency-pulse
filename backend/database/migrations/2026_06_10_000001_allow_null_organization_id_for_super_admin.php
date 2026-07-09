<?php

use App\Support\DatabaseMigration;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return;
        }

        if (DatabaseMigration::columnIsNullable('users', 'organization_id')) {
            return;
        }

        DatabaseMigration::makeOrganizationIdNullable('users');
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return;
        }

        if (DB::table('users')->whereNull('organization_id')->exists()) {
            throw new RuntimeException('Cannot revert: super admin users require nullable organization_id.');
        }

        DatabaseMigration::makeOrganizationIdRequired('users');
    }
};
