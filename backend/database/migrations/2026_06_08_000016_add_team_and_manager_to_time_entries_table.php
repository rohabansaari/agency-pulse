<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->foreignId('team_id')->nullable()->after('project_id')->constrained('teams')->nullOnDelete();
            $table->foreignId('manager_id')->nullable()->after('team_id')->constrained('users')->nullOnDelete();

            $table->index(['manager_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropForeign(['team_id']);
            $table->dropForeign(['manager_id']);
            $table->dropIndex(['manager_id', 'status']);
            $table->dropColumn(['team_id', 'manager_id']);
        });
    }
};
