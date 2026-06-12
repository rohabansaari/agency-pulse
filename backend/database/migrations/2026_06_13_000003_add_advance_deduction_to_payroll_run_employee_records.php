<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->decimal('advance_deduction_snapshot', 12, 2)->default(0)->after('bonuses_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->dropColumn('advance_deduction_snapshot');
        });
    }
};
