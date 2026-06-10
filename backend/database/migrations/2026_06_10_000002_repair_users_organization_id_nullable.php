<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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

        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        if ($this->organizationIdIsNullable()) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
        });

        DB::statement('ALTER TABLE users MODIFY organization_id BIGINT UNSIGNED NULL');

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('organization_id')
                ->references('id')
                ->on('organizations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally empty — handled by the primary migration down().
    }

    private function organizationIdIsNullable(): bool
    {
        $result = DB::selectOne("
            SELECT IS_NULLABLE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'organization_id'
        ");

        return ($result->IS_NULLABLE ?? 'NO') === 'YES';
    }
};
