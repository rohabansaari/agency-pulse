<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('screenshots', function (Blueprint $table) {
            // Seconds with keyboard/mouse input during the capture window the agent reports.
            // Null for screenshots from agents that predate activity tracking.
            $table->unsignedInteger('active_seconds')->nullable()->after('file_size_bytes');
            $table->unsignedInteger('activity_window_seconds')->nullable()->after('active_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('screenshots', function (Blueprint $table) {
            $table->dropColumn(['active_seconds', 'activity_window_seconds']);
        });
    }
};
