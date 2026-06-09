<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::table('users')->exists()) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('organization_id')
                    ->after('id')
                    ->constrained()
                    ->cascadeOnDelete();
            });

            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('organization_id')
                ->nullable()
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
        });

        foreach (DB::table('users')->whereNull('organization_id')->get() as $user) {
            $organizationId = DB::table('organizations')->insertGetId([
                'name' => $user->name."'s Organization",
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('users')
                ->where('id', $user->id)
                ->update(['organization_id' => $organizationId]);
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY organization_id BIGINT UNSIGNED NOT NULL');
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('organization_id');
        });
    }
};
