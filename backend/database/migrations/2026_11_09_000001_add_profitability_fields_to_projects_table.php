<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('billing_type')->default('hourly')->after('hourly_rate');
            $table->decimal('budget_hours', 10, 2)->nullable()->after('billing_type');
            $table->decimal('budget_amount', 14, 2)->nullable()->after('budget_hours');
            $table->date('starts_on')->nullable()->after('budget_amount');
            $table->date('due_on')->nullable()->after('starts_on');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['billing_type', 'budget_hours', 'budget_amount', 'starts_on', 'due_on']);
        });
    }
};
