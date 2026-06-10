<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->boolean('onboarding_completed')->default(false)->after('status');
            $table->unsignedTinyInteger('onboarding_step')->default(1)->after('onboarding_completed');
            $table->string('timezone')->nullable()->after('onboarding_step');
            $table->string('logo_url')->nullable()->after('timezone');
            $table->string('website')->nullable()->after('logo_url');
        });

        DB::table('organizations')
            ->whereNotNull('payroll_pin')
            ->update(['onboarding_completed' => true]);
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn([
                'onboarding_completed',
                'onboarding_step',
                'timezone',
                'logo_url',
                'website',
            ]);
        });
    }
};
