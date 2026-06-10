<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('organization_payroll_settings')
            ->whereIn('organization_id', function ($query) {
                $query->select('id')
                    ->from('organizations')
                    ->whereNotNull('payroll_pin');
            })
            ->update(['overtime_enabled' => true]);
    }

    public function down(): void
    {
        // No rollback — overtime may have been intentionally enabled.
    }
};
