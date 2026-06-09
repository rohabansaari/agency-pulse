<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->unsignedInteger('regular_hours_seconds')->default(0)->after('payable_hours_seconds');
            $table->decimal('regular_pay_snapshot', 12, 2)->default(0)->after('regular_hours_seconds');
            $table->unsignedInteger('overtime_hours_seconds')->default(0)->after('regular_pay_snapshot');
            $table->decimal('overtime_rate_percent_snapshot', 6, 2)->nullable()->after('overtime_hours_seconds');
            $table->decimal('overtime_pay_snapshot', 12, 2)->default(0)->after('overtime_rate_percent_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_run_employee_records', function (Blueprint $table) {
            $table->dropColumn([
                'regular_hours_seconds',
                'regular_pay_snapshot',
                'overtime_hours_seconds',
                'overtime_rate_percent_snapshot',
                'overtime_pay_snapshot',
            ]);
        });
    }
};
