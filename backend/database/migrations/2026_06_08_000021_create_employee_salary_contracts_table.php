<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_salary_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('salary_type');
            $table->text('hourly_rate')->nullable();
            $table->text('monthly_salary')->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['organization_id', 'user_id', 'is_active'], 'esc_org_user_active_idx');
            $table->index(['user_id', 'effective_from'], 'esc_user_effective_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_salary_contracts');
    }
};
