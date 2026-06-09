<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_payroll_settings', function (Blueprint $table) {
            $table->boolean('overtime_enabled')->default(false)->after('custom_deduction_percent');
            $table->decimal('overtime_rate_percentage', 6, 2)->default(125)->after('overtime_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('organization_payroll_settings', function (Blueprint $table) {
            $table->dropColumn(['overtime_enabled', 'overtime_rate_percentage']);
        });
    }
};
