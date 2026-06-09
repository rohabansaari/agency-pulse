<?php

namespace App\Services\Payroll;

use App\Enums\PayrollRunStatus;
use App\Models\PayrollRun;
use App\Models\TimeEntry;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PayrollPeriodLockService
{
    public function assertDateModifiable(Carbon $date): void
    {
        if ($this->isDateInLockedPeriod($date)) {
            throw ValidationException::withMessages([
                'payroll_period' => ['This period is covered by a finalized or locked payroll run and cannot be modified.'],
            ]);
        }
    }

    public function assertTimeEntryModifiable(TimeEntry $entry): void
    {
        if ($entry->start_time) {
            $this->assertDateModifiable($entry->start_time->copy()->startOfDay());
        }
    }

    public function isDateInLockedPeriod(Carbon $date): bool
    {
        return PayrollRun::query()
            ->where('organization_id', TenantContext::id())
            ->whereIn('status', [
                PayrollRunStatus::Finalized->value,
                PayrollRunStatus::Locked->value,
            ])
            ->whereDate('period_start', '<=', $date->toDateString())
            ->whereDate('period_end', '>=', $date->toDateString())
            ->exists();
    }
}
