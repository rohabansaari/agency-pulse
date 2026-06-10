<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_change_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('changed_by')->constrained('users')->cascadeOnDelete();
            $table->string('salary_type');
            $table->text('previous_salary_encrypted')->nullable();
            $table->text('new_salary_encrypted');
            $table->date('effective_date');
            $table->timestamps();

            $table->index(['organization_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_change_audits');
    }
};
