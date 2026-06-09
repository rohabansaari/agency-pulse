<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->boolean('is_paid')->default(false)->after('description');
            $table->string('source')->nullable()->after('is_paid');

            $table->index(['type', 'status', 'is_paid']);
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropIndex(['type', 'status', 'is_paid']);
            $table->dropColumn(['is_paid', 'source']);
        });
    }
};
