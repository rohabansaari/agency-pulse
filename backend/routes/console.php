<?php

use App\Models\IdempotencyRecord;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('idempotency:purge', function () {
    $deleted = IdempotencyRecord::query()
        ->where('expires_at', '<=', now())
        ->delete();

    $this->info("Purged {$deleted} expired idempotency records.");
})->purpose('Remove expired idempotency records');

Schedule::command('idempotency:purge')->daily();
