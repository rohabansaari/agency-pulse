<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            // Why a paused segment was paused: null = by the user, "agent_offline" = automatically.
            $table->string('pause_reason', 32)->nullable()->after('paused');
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropColumn('pause_reason');
        });
    }
};
