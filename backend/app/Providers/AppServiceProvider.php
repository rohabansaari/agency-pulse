<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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

        // Public sign-up: a few tries a minute and a cap per day for each IP address.
        RateLimiter::for('signup', fn (Request $request) => [
            Limit::perMinute(5)->by('signup-min:'.$request->ip()),
            Limit::perDay(20)->by('signup-day:'.$request->ip()),
        ]);

        $mailConfiguration = $this->app->make(MailConfiguration::class);
        $mailConfiguration->applyRuntimeFixes();
        $mailConfiguration->logProductionMisconfiguration();

        Event::listen(MessageSending::class, [LogInvitationMailDelivery::class, 'handleSending']);
        Event::listen(MessageSent::class, [LogInvitationMailDelivery::class, 'handleSent']);
    }
}
