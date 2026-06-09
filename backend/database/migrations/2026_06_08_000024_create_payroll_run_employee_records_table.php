<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_run_employee_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('salary_type', 16);
            $table->unsignedInteger('payable_hours_seconds');
            $table->decimal('hourly_equivalent_snapshot', 12, 4)->nullable();
            $table->decimal('gross_salary_snapshot', 12, 2);
            $table->string('deduction_mode_snapshot', 32);
            $table->unsignedTinyInteger('working_days_per_month_snapshot');
            $table->unsignedTinyInteger('working_hours_per_day_snapshot');
            $table->decimal('income_tax_percent_snapshot', 5, 2);
            $table->decimal('eobi_percent_snapshot', 5, 2);
            $table->decimal('social_security_percent_snapshot', 5, 2);
            $table->decimal('custom_deduction_percent_snapshot', 5, 2);
            $table->decimal('income_tax_snapshot', 12, 2);
            $table->decimal('eobi_snapshot', 12, 2);
            $table->decimal('social_security_snapshot', 12, 2);
            $table->decimal('custom_deduction_snapshot', 12, 2);
            $table->decimal('bonuses_snapshot', 12, 2)->default(0);
            $table->decimal('net_salary_snapshot', 12, 2);
            $table->timestamps();

            $table->unique(['payroll_run_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_run_employee_records');
    }
};
