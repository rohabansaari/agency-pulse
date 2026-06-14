<?php

namespace App\Providers;

use App\Services\Mail\MailConfiguration;
use App\Services\Payroll\Deductions\PayrollDeductionEngine;
use App\Services\Payroll\Deductions\PercentagePayrollDeductionCalculator;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use App\Listeners\LogInvitationMailDelivery;

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

        $mailConfiguration = $this->app->make(MailConfiguration::class);
        $mailConfiguration->applyRuntimeFixes();
        $mailConfiguration->logProductionMisconfiguration();

        Event::listen(MessageSending::class, [LogInvitationMailDelivery::class, 'handleSending']);
        Event::listen(MessageSent::class, [LogInvitationMailDelivery::class, 'handleSent']);
    }
}
