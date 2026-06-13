<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_leave_balances', function (Blueprint $table) {
            if (! Schema::hasColumn('employee_leave_balances', 'medical_limit_days')) {
                $table->unsignedSmallInteger('medical_limit_days')->default(10)->after('user_id');
            }
            if (! Schema::hasColumn('employee_leave_balances', 'medical_used_days')) {
                $table->decimal('medical_used_days', 6, 2)->default(0)->after('medical_limit_days');
            }
            if (! Schema::hasColumn('employee_leave_balances', 'casual_limit_days')) {
                $table->unsignedSmallInteger('casual_limit_days')->default(10)->after('medical_used_days');
            }
            if (! Schema::hasColumn('employee_leave_balances', 'casual_used_days')) {
                $table->decimal('casual_used_days', 6, 2)->default(0)->after('casual_limit_days');
            }
        });

        Schema::table('time_entries', function (Blueprint $table) {
            if (! Schema::hasColumn('time_entries', 'leave_category')) {
                $table->string('leave_category', 16)->default('annual')->after('is_paid');
            }
        });
    }

    public function down(): void
    {
        Schema::table('employee_leave_balances', function (Blueprint $table) {
            $table->dropColumn([
                'medical_limit_days',
                'medical_used_days',
                'casual_limit_days',
                'casual_used_days',
            ]);
        });

        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropColumn('leave_category');
        });
    }
};
