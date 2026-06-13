<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->json('adjustment_lines_snapshot')->nullable()->after('advance_deduction_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->dropColumn('adjustment_lines_snapshot');
        });
    }
};
