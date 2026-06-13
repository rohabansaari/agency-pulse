<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('payroll_run_employee_records', 'adjustment_lines_snapshot')) {
            return;
        }

        $afterAdvance = Schema::hasColumn('payroll_run_employee_records', 'advance_deduction_snapshot');

        Schema::table('payroll_run_employee_records', function (Blueprint $table) use ($afterAdvance) {
            if ($afterAdvance) {
                $table->json('adjustment_lines_snapshot')->nullable()->after('advance_deduction_snapshot');
            } else {
                $table->json('adjustment_lines_snapshot')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->dropColumn('adjustment_lines_snapshot');
        });
    }
};
