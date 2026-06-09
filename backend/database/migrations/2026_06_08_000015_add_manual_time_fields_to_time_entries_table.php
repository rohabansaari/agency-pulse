<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->string('type')->default('tracked')->after('organization_id');
            $table->text('description')->nullable()->after('duration');
            $table->foreignId('approved_by')->nullable()->after('description')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');

            $table->index(['organization_id', 'type', 'status']);
        });

        DB::table('time_entries')->whereNull('type')->update(['type' => 'tracked']);
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropIndex(['organization_id', 'type', 'status']);
            $table->dropColumn(['type', 'description', 'approved_by', 'approved_at']);
        });
    }
};
