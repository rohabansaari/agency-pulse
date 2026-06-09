<?php

namespace App\Providers;

use App\Services\Payroll\Deductions\PayrollDeductionEngine;
use App\Services\Payroll\Deductions\PercentagePayrollDeductionCalculator;
use Illuminate\Http\Resources\Json\JsonResource;
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
    }
}
