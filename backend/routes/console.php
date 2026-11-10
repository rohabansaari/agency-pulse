<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Auth\SuperAdminBootstrap;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

use App\Models\IdempotencyRecord;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('super-admin:reset-password', function () {
    $superAdmin = User::query()
        ->where('role', UserRole::SuperAdmin)
        ->whereNull('organization_id')
        ->first();

    if (! $superAdmin) {
        $this->error('No super admin account exists.');

        return 1;
    }

    $currentPassword = $this->secret('Current password');
    $newPassword = $this->secret('New password');
    $confirmPassword = $this->secret('Confirm new password');

    if (! is_string($currentPassword) || ! Hash::check($currentPassword, $superAdmin->password)) {
        $this->error('Current password is incorrect.');

        return 1;
    }

    if (! is_string($newPassword) || $newPassword !== $confirmPassword) {
        $this->error('New password confirmation does not match.');

        return 1;
    }

    $validator = validator(
        ['password' => $newPassword],
        ['password' => ['required', 'string', Password::defaults()]],
    );

    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $message) {
            $this->error($message);
        }

        return 1;
    }

    $superAdmin->forceFill(['password' => $newPassword])->save();
    $this->info('Super admin password updated successfully.');

    return 0;
})->purpose('Reset the platform super admin password securely');

Artisan::command('super-admin:ensure', function () {
    SuperAdminBootstrap::ensureExists();
    $this->info('Super admin bootstrap completed.');

    return 0;
})->purpose('Create the platform super admin if missing');

Artisan::command('idempotency:purge', function () {
    $deleted = IdempotencyRecord::query()
        ->where('expires_at', '<=', now())
        ->delete();

    $this->info("Purged {$deleted} expired idempotency records.");
})->purpose('Remove expired idempotency records');

Artisan::command('timers:pause-offline-agents', function (\App\Services\Time\AgentTimerGuard $guard) {
    $paused = $guard->enforceEverywhere();
    $this->info("Paused {$paused} timers whose desktop agent went offline.");
})->purpose('Pause running timers whose desktop agent stopped checking in');

Schedule::command('timers:pause-offline-agents')->everyFiveMinutes();
Schedule::command('idempotency:purge')->daily();
Schedule::command('screenshots:purge-expired')->daily();

/*
 * Loads the Settings → Sample data set into an organization from the command
 * line (or at boot via SAMPLE_DATA_FOR, see vercel/start.sh). `organization`
 * is an id, an exact name, or "only" for a database with a single company.
 * Does nothing if sample data is already loaded there.
 */
Artisan::command('sample-data:load {organization}', function (string $organization) {
    $companies = \App\Models\Organization::query()->orderBy('id')->get();

    $target = match (true) {
        $organization === 'only' => $companies->count() === 1 ? $companies->first() : null,
        ctype_digit($organization) => $companies->firstWhere('id', (int) $organization),
        default => $companies->firstWhere('name', $organization),
    };

    if ($target === null) {
        $this->error("No single organization matches \"{$organization}\". Organizations:");
        foreach ($companies as $company) {
            $this->line("  #{$company->id} {$company->name}");
        }

        return 1;
    }

    $admin = User::query()
        ->where('organization_id', $target->id)
        ->where('role', UserRole::Admin)
        ->orderBy('id')
        ->first();

    if ($admin === null) {
        $this->error("Organization #{$target->id} {$target->name} has no admin.");

        return 1;
    }

    \App\Services\Tenant\TenantContext::set($target);

    try {
        $service = app(\App\Services\SampleData\SampleDataService::class);

        if ($service->status()['loaded']) {
            $this->info("Sample data is already loaded in #{$target->id} {$target->name}.");

            return 0;
        }

        $created = $service->load($admin);
        $this->info("Loaded sample data into #{$target->id} {$target->name}: ".json_encode($created));

        return 0;
    } catch (\Illuminate\Validation\ValidationException $e) {
        $this->error(collect($e->errors())->flatten()->implode(' '));

        return 1;
    } finally {
        \App\Services\Tenant\TenantContext::forget();
    }
})->purpose('Load the sample data set into an organization');
