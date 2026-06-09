<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::table('time_entries')->exists()) {
            Schema::table('time_entries', function (Blueprint $table) {
                $table->foreignId('organization_id')
                    ->after('user_id')
                    ->constrained()
                    ->cascadeOnDelete();
                $table->foreign('project_id')
                    ->references('id')
                    ->on('projects')
                    ->nullOnDelete();
                $table->index(['organization_id', 'start_time']);
            });

            return;
        }

        Schema::table('time_entries', function (Blueprint $table) {
            $table->foreignId('organization_id')
                ->nullable()
                ->after('user_id')
                ->constrained()
                ->cascadeOnDelete();
        });

        foreach (DB::table('time_entries')->whereNull('organization_id')->get() as $entry) {
            $organizationId = DB::table('users')
                ->where('id', $entry->user_id)
                ->value('organization_id');

            if ($organizationId) {
                DB::table('time_entries')
                    ->where('id', $entry->id)
                    ->update(['organization_id' => $organizationId]);
            }
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE time_entries MODIFY organization_id BIGINT UNSIGNED NOT NULL');
        } else {
            Schema::table('time_entries', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable(false)->change();
            });
        }

        Schema::table('time_entries', function (Blueprint $table) {
            $table->foreign('project_id')
                ->references('id')
                ->on('projects')
                ->nullOnDelete();
            $table->index(['organization_id', 'start_time']);
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->dropIndex(['organization_id', 'start_time']);
            $table->dropConstrainedForeignId('organization_id');
        });
    }
};
