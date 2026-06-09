<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_run_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignId('time_entry_id')->constrained('time_entries')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('entry_type');
            $table->unsignedBigInteger('duration_seconds');
            $table->decimal('hourly_rate_snapshot', 10, 2)->nullable();
            $table->decimal('pay_snapshot', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['payroll_run_id', 'time_entry_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_run_entries');
    }
};
