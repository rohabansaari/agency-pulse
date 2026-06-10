<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY organization_id BIGINT UNSIGNED NULL');
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'organization_id')) {
            return;
        }

        if (DB::table('users')->whereNull('organization_id')->exists()) {
            throw new RuntimeException('Cannot revert: super admin users require nullable organization_id.');
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY organization_id BIGINT UNSIGNED NOT NULL');
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable(false)->change();
            });
        }
    }
};
