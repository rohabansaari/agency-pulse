<?php

use App\Support\DatabaseMigration;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Repairs production databases where the first nullable migration ran before
 * the foreign-key-safe version existed, leaving organization_id NOT NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return;
        }

        if (! in_array(DatabaseMigration::driver(), ['mysql', 'pgsql'], true)) {
            return;
        }

        if (DatabaseMigration::columnIsNullable('users', 'organization_id')) {
            return;
        }

        DatabaseMigration::makeOrganizationIdNullable('users');
    }

    public function down(): void
    {
        // Intentionally empty — handled by the primary migration down().
    }
};
