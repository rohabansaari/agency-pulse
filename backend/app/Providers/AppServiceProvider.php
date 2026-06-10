<?php

namespace App\Providers;

use App\Services\Auth\SuperAdminBootstrap;
use App\Services\Payroll\Deductions\PayrollDeductionEngine;
use App\Services\Payroll\Deductions\PercentagePayrollDeductionCalculator;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PayrollDeductionEngine::class, function () {
            return new PayrollDeductionEngine([
                new PercentagePayrollDeductionCalculator,
            ]);
        });
    }

    public function boot(): void
    {
        JsonResource::withoutWrapping();

        if ($this->app->runningUnitTests()) {
            return;
        }

        if (Schema::hasTable('users')) {
            SuperAdminBootstrap::ensureExists();
        }
    }
}
