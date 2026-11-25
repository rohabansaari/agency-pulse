<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Terms of Service and Privacy Policy, accepted by the person who signs a company up.
            $table->timestamp('terms_accepted_at')->nullable();
            $table->string('terms_version', 20)->nullable();
            // Each person's acknowledgement of the time, activity and screenshot notice.
            $table->timestamp('monitoring_consent_at')->nullable();
            $table->string('monitoring_consent_version', 20)->nullable();
            $table->string('monitoring_consent_ip', 45)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'terms_accepted_at',
                'terms_version',
                'monitoring_consent_at',
                'monitoring_consent_version',
                'monitoring_consent_ip',
            ]);
        });
    }
};
