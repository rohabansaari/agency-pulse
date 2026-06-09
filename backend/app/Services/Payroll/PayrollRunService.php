<?php



namespace App\Services\Payroll;



use App\Enums\PayrollRunStatus;

use App\Enums\UserRole;

use App\Models\PayrollRun;

use App\Models\PayrollRunEmployeeRecord;

use App\Models\PayrollRunEntry;

use App\Models\TimeEntry;

use App\Models\User;

use App\Services\Audit\AuditLogger;

use App\Services\Tenant\TenantContext;

use App\Support\DisplayDate;

use Illuminate\Support\Carbon;

use Illuminate\Support\Collection;

use Illuminate\Support\Facades\DB;

use Illuminate\Validation\ValidationException;



class PayrollRunService

{

    public function __construct(

        private readonly AuditLogger $audit,

        private readonly PayrollCalculationService $payrollCalculation,

        private readonly \App\Services\Time\OvertimeRequestService $overtimeRequests

    ) {}



    /**

     * @param  array<string, mixed>  $data

     */

    public function create(User $admin, array $data): PayrollRun

    {

        $this->ensureAdmin($admin);



        $periodStart = DisplayDate::parse($data['period_start'], 'period_start');

        $periodEnd = DisplayDate::parse($data['period_end'], 'period_end');



        if ($periodEnd->lt($periodStart)) {

            throw ValidationException::withMessages([

                'period_end' => ['Period end must be on or after period start.'],

            ]);

        }



        $this->assertNoOverlappingLockedRun($periodStart, $periodEnd);



        return DB::transaction(function () use ($admin, $periodStart, $periodEnd) {

            $snapshot = $this->buildSnapshot($periodStart, $periodEnd);



            $run = PayrollRun::create([

                'organization_id' => TenantContext::id(),

                'period_start' => $periodStart,

                'period_end' => $periodEnd,

                'status' => PayrollRunStatus::Draft,

                'total_hours_snapshot' => $snapshot['total_seconds'],

                'total_pay_snapshot' => $snapshot['total_pay'],

                'total_net_snapshot' => $snapshot['total_net'],

                'created_by' => $admin->id,

            ]);



            foreach ($snapshot['lines'] as $line) {

                PayrollRunEntry::create([

                    'payroll_run_id' => $run->id,

                    ...$line,

                ]);

            }



            foreach ($snapshot['employee_records'] as $record) {

                PayrollRunEmployeeRecord::create([

                    'payroll_run_id' => $run->id,

                    ...$record,

                ]);

            }



            $this->audit->log('payroll_run.created', $run, $admin, [

                'period_start' => DisplayDate::format($periodStart),

                'period_end' => DisplayDate::format($periodEnd),

                'total_hours_snapshot' => $snapshot['total_seconds'],

                'total_pay_snapshot' => (string) $snapshot['total_pay'],

                'total_net_snapshot' => (string) $snapshot['total_net'],

                'entry_count' => count($snapshot['lines']),

                'employee_count' => count($snapshot['employee_records']),

            ]);



            return $run->fresh([

                'creator',

                'entries.user',

                'entries.timeEntry',

                'employeeRecords.user',

            ]);

        });

    }



    public function finalize(PayrollRun $run, User $admin): PayrollRun

    {

        $this->ensureAdmin($admin);

        $this->ensureSameOrganization($run);



        if ($run->status !== PayrollRunStatus::Draft) {

            throw ValidationException::withMessages([

                'status' => ['Only draft payroll runs can be finalized.'],

            ]);

        }



        $run->update([

            'status' => PayrollRunStatus::Finalized,

            'finalized_by' => $admin->id,

            'finalized_at' => now(),

        ]);



        $this->audit->log('payroll_run.finalized', $run->fresh(), $admin, [

            'period_start' => DisplayDate::format($run->period_start),

            'period_end' => DisplayDate::format($run->period_end),

        ]);



        return $run->fresh(['creator', 'finalizer', 'entries.user', 'employeeRecords.user']);

    }



    public function lock(PayrollRun $run, User $admin): PayrollRun

    {

        $this->ensureAdmin($admin);

        $this->ensureSameOrganization($run);



        if ($run->status !== PayrollRunStatus::Finalized) {

            throw ValidationException::withMessages([

                'status' => ['Only finalized payroll runs can be locked.'],

            ]);

        }



        $run->update([

            'status' => PayrollRunStatus::Locked,

            'locked_by' => $admin->id,

            'locked_at' => now(),

        ]);



        $this->audit->log('payroll_run.locked', $run->fresh(), $admin);



        return $run->fresh(['creator', 'finalizer', 'locker', 'entries.user', 'employeeRecords.user']);

    }



    public function unlock(PayrollRun $run, User $admin): PayrollRun

    {

        $this->ensureAdmin($admin);

        $this->ensureSameOrganization($run);



        if (! in_array($run->status, [PayrollRunStatus::Finalized, PayrollRunStatus::Locked], true)) {

            throw ValidationException::withMessages([

                'status' => ['Only finalized or locked payroll runs can be unlocked.'],

            ]);

        }



        $previousStatus = $run->status->value;



        $run->update([

            'status' => PayrollRunStatus::Draft,

            'finalized_by' => null,

            'finalized_at' => null,

            'locked_by' => null,

            'locked_at' => null,

        ]);



        $this->audit->log('payroll_run.unlocked', $run->fresh(), $admin, [

            'previous_status' => $previousStatus,

        ]);



        return $run->fresh(['creator', 'entries.user', 'employeeRecords.user']);

    }



    /**

     * @return Collection<int, PayrollRun>

     */

    public function listForOrganization(?Carbon $rangeStart = null, ?Carbon $rangeEnd = null): Collection

    {

        $query = PayrollRun::query()

            ->with(['creator', 'finalizer', 'locker'])

            ->withCount(['entries', 'employeeRecords'])

            ->where('organization_id', TenantContext::id());



        if ($rangeStart !== null && $rangeEnd !== null) {

            $query->where(function ($builder) use ($rangeStart, $rangeEnd) {

                $builder->where('period_start', '<=', $rangeEnd->toDateString())

                    ->where('period_end', '>=', $rangeStart->toDateString());

            });

        }



        return $query

            ->orderByDesc('period_start')

            ->get();

    }



    public function show(PayrollRun $run): PayrollRun

    {

        $this->ensureSameOrganization($run);



        return $run->load([

            'creator',

            'finalizer',

            'locker',

            'entries.user',

            'entries.timeEntry.project',

            'employeeRecords.user',

        ]);

    }



    /**

     * @return array{

     *     total_seconds: int,

     *     total_pay: string,

     *     total_net: string,

     *     lines: list<array<string, mixed>>,

     *     employee_records: list<array<string, mixed>>

     * }

     */

    private function buildSnapshot(Carbon $periodStart, Carbon $periodEnd): array

    {

        $entries = TimeEntry::query()

            ->countable()

            ->where('organization_id', TenantContext::id())

            ->whereBetween('start_time', [

                $periodStart->copy()->startOfDay(),

                $periodEnd->copy()->endOfDay(),

            ])

            ->orderBy('start_time')

            ->get();



        $approvedOvertime = $this->overtimeRequests->approvedForPeriod($periodStart, $periodEnd);



        return $this->payrollCalculation->buildSnapshot(

            $entries,

            $periodStart,

            $periodEnd,

            $approvedOvertime

        );

    }



    private function assertNoOverlappingLockedRun(Carbon $periodStart, Carbon $periodEnd): void

    {

        $overlap = PayrollRun::query()

            ->where('organization_id', TenantContext::id())

            ->whereIn('status', [

                PayrollRunStatus::Draft->value,

                PayrollRunStatus::Finalized->value,

                PayrollRunStatus::Locked->value,

            ])

            ->whereDate('period_start', '<=', $periodEnd->toDateString())

            ->whereDate('period_end', '>=', $periodStart->toDateString())

            ->exists();



        if ($overlap) {

            throw ValidationException::withMessages([

                'period_start' => ['A payroll run already exists for an overlapping period.'],

            ]);

        }

    }



    private function ensureAdmin(User $user): void

    {

        if ($user->currentRole() !== UserRole::Admin) {

            abort(403, 'Only admins can manage payroll runs.');

        }

    }



    private function ensureSameOrganization(PayrollRun $run): void

    {

        if ($run->organization_id !== TenantContext::id()) {

            abort(404);

        }

    }

}

