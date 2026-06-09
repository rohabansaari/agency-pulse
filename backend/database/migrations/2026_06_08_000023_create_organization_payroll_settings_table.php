<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_payroll_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('working_days_per_month')->default(22);
            $table->unsignedTinyInteger('working_hours_per_day')->default(8);
            $table->string('deduction_mode', 32)->default('percentage');
            $table->decimal('income_tax_percent', 5, 2)->default(0);
            $table->decimal('eobi_percent', 5, 2)->default(0);
            $table->decimal('social_security_percent', 5, 2)->default(0);
            $table->decimal('custom_deduction_percent', 5, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_payroll_settings');
    }
};
