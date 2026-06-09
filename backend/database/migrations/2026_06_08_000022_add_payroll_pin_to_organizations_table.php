<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->text('payroll_pin')->nullable()->after('status');
            $table->timestamp('payroll_pin_created_at')->nullable()->after('payroll_pin');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['payroll_pin', 'payroll_pin_created_at']);
        });
    }
};
