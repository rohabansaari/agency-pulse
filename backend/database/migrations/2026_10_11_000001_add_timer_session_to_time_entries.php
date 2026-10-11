<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            // Segments of one timer session (start → pause/resume … → stop) share this key.
            $table->uuid('timer_session')->nullable()->after('status');
            // True on the last segment of a session that is paused and can be resumed.
            $table->boolean('paused')->default(false)->after('timer_session');
            $table->index(['user_id', 'paused']);
            $table->index('timer_session');
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'paused']);
            $table->dropIndex(['timer_session']);
            $table->dropColumn(['timer_session', 'paused']);
        });
    }
};
