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

Schedule::command('idempotency:purge')->daily();
Schedule::command('screenshots:purge-expired')->daily();
