<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            // Minutes without keyboard/mouse input before a running timer is paused; 0 = off.
            $table->unsignedSmallInteger('idle_timeout_minutes')->default(10)->after('timezone');
        });

        Schema::table('time_entries', function (Blueprint $table) {
            // A segment covering idle time the employee chose to keep (e.g. a call or meeting).
            $table->boolean('idle_kept')->default(false)->after('pause_reason');
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropColumn('idle_kept');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('idle_timeout_minutes');
        });
    }
};
