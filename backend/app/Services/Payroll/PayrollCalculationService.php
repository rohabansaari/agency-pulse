<?php



namespace App\Services\Payroll;



use App\Enums\SalaryType;

use App\Models\EmployeeSalaryContract;

use App\Models\OrganizationPayrollSettings;

use App\Models\TimeEntry;

use App\Services\Payroll\Deductions\PayrollDeductionEngine;
use App\Services\Payroll\PayrollComponentService;
use App\Services\Payroll\SalaryAdvanceService;

use App\Services\Tenant\TenantContext;

use Illuminate\Support\Carbon;

use Illuminate\Support\Collection;

use Illuminate\Support\Facades\Log;



class PayrollCalculationService

{

    public function __construct(

        private readonly PayrollSettingsService $payrollSettings,

        private readonly PayrollDeductionEngine $deductionEngine,

        private readonly PayrollComponentService $payrollComponents,

        private readonly SalaryAdvanceService $salaryAdvances,

    ) {}



    public function activeContractForUser(int $userId, Carbon $asOf): ?EmployeeSalaryContract

    {

        return EmployeeSalaryContract::query()

            ->where('organization_id', TenantContext::id())

            ->where('user_id', $userId)

            ->where('is_active', true)

            ->whereDate('effective_from', '<=', $asOf->toDateString())

            ->where(function ($query) use ($asOf) {

                $query->whereNull('effective_to')

                    ->orWhereDate('effective_to', '>=', $asOf->toDateString());

            })

            ->orderByDesc('effective_from')

            ->first();

    }



    public function decryptHourlyRate(EmployeeSalaryContract $contract): ?float

    {

        if ($contract->salary_type !== SalaryType::Hourly || $contract->hourly_rate === null) {

            return null;

        }



        return (float) $contract->hourly_rate;

    }



    public function decryptMonthlySalary(EmployeeSalaryContract $contract): ?float

    {

        if ($contract->salary_type !== SalaryType::Monthly || $contract->monthly_salary === null) {

            return null;

        }



        return (float) $contract->monthly_salary;

    }



    public function expectedMonthlyHours(OrganizationPayrollSettings $settings): float

    {

        return $settings->expectedMonthlyHours();

    }



    public function effectiveHourlyRate(

        EmployeeSalaryContract $contract,

        OrganizationPayrollSettings $settings

    ): ?float {

        if ($contract->salary_type === SalaryType::Hourly) {

            return $this->decryptHourlyRate($contract);

        }



        if ($contract->salary_type === SalaryType::Monthly) {

            $monthly = $this->decryptMonthlySalary($contract);



            if ($monthly === null) {

                return null;

            }



            $expectedHours = $this->expectedMonthlyHours($settings);



            if ($expectedHours <= 0) {

                return null;

            }



            return $monthly / $expectedHours;

        }



        return null;

    }



    public function overtimeHourlyRate(
        EmployeeSalaryContract $contract,
        OrganizationPayrollSettings $settings
    ): ?float {
        $baseRate = $this->effectiveHourlyRate($contract, $settings);

        if ($baseRate === null || $baseRate <= 0 || ! $settings->overtime_enabled) {
            return null;
        }

        return round($baseRate * ((float) $settings->overtime_rate_percentage / 100), 4);
    }

    public function overtimePayForSeconds(
        int $overtimeSeconds,
        EmployeeSalaryContract $contract,
        OrganizationPayrollSettings $settings
    ): float {
        $rate = $this->overtimeHourlyRate($contract, $settings);

        if ($rate === null || $overtimeSeconds <= 0) {
            return 0.0;
        }

        return round(($overtimeSeconds / 3600) * $rate, 2);
    }

    public function entryPay(

        int $durationSeconds,

        EmployeeSalaryContract $contract,

        OrganizationPayrollSettings $settings

    ): float {

        $rate = $this->effectiveHourlyRate($contract, $settings);



        if ($rate === null || $rate <= 0) {

            return 0.0;

        }



        $hours = $durationSeconds / 3600;

        $pay = round($hours * $rate, 2);



        Log::debug('payroll.entry_calculated', [

            'user_id' => $contract->user_id,

            'salary_type' => $contract->salary_type->value,

            'hourly_rate' => round($rate, 4),

            'total_hours' => round($hours, 4),

            'final_pay' => $pay,

        ]);



        return $pay;

    }



    public function grossSalaryForPayableHours(

        int $payableSeconds,

        EmployeeSalaryContract $contract,

        OrganizationPayrollSettings $settings

    ): float {

        $rate = $this->effectiveHourlyRate($contract, $settings);



        if ($rate === null || $rate <= 0 || $payableSeconds <= 0) {

            return 0.0;

        }



        return round(($payableSeconds / 3600) * $rate, 2);

    }



    /**

     * @param  Collection<int, TimeEntry>  $entries

     * @return array{

     *     total_seconds: int,

     *     total_pay: string,

     *     total_net: string,

     *     lines: list<array<string, mixed>>,

     *     employee_records: list<array<string, mixed>>

     * }

     */

    public function buildSnapshot(

        Collection $entries,

        Carbon $periodStart,

        Carbon $periodEnd,

        ?Collection $overtimeRequests = null

    ): array {

        $settings = $this->payrollSettings->forOrganization();

        $overtimeRequests ??= collect();

        $linesResult = $this->buildSnapshotLines($entries, $periodStart, $periodEnd, $settings);

        $employeeRecords = $this->buildEmployeeRecords($entries, $overtimeRequests, $settings, $periodEnd);



        $totalGross = array_sum(array_map(

            fn (array $record) => (float) $record['gross_salary_snapshot'],

            $employeeRecords

        ));

        $totalNet = array_sum(array_map(

            fn (array $record) => (float) $record['net_salary_snapshot'],

            $employeeRecords

        ));



        Log::debug('payroll.snapshot_totals', [

            'period_start' => $periodStart->toDateString(),

            'period_end' => $periodEnd->toDateString(),

            'total_hours' => round($linesResult['total_seconds'] / 3600, 4),

            'gross_pay' => round($totalGross, 2),

            'net_pay' => round($totalNet, 2),

        ]);



        return [

            'total_seconds' => $linesResult['total_seconds'] + (int) $overtimeRequests->sum('duration_seconds'),

            'total_pay' => number_format($totalGross, 2, '.', ''),

            'total_net' => number_format($totalNet, 2, '.', ''),

            'lines' => $linesResult['lines'],

            'employee_records' => $employeeRecords,

        ];

    }



    /**

     * @param  Collection<int, TimeEntry>  $entries

     * @return array{total_seconds: int, lines: list<array<string, mixed>>}

     */

    private function buildSnapshotLines(

        Collection $entries,

        Carbon $periodStart,

        Carbon $periodEnd,

        OrganizationPayrollSettings $settings

    ): array {

        $contractsByUser = $this->loadContractsForUsers(

            $entries->pluck('user_id')->unique()->all(),

            $periodEnd

        );



        $totalSeconds = 0;

        $lines = [];



        foreach ($entries as $entry) {

            $duration = (int) ($entry->duration ?? 0);

            $contract = $contractsByUser->get($entry->user_id);

            $payMeta = $this->entryPaySnapshot($duration, $contract, $settings);



            $totalSeconds += $duration;



            $lines[] = [

                'time_entry_id' => $entry->id,

                'user_id' => $entry->user_id,

                'entry_type' => $entry->type->value,

                'duration_seconds' => $duration,

                'hourly_rate_snapshot' => $payMeta['hourly_rate_snapshot'],

                'pay_snapshot' => $payMeta['pay_snapshot'],

            ];

        }



        return [

            'total_seconds' => $totalSeconds,

            'lines' => $lines,

        ];

    }



    /**

     * @param  Collection<int, TimeEntry>  $entries

     * @return list<array<string, mixed>>

     */

    private function buildEmployeeRecords(

        Collection $entries,

        Collection $overtimeRequests,

        OrganizationPayrollSettings $settings,

        Carbon $periodEnd

    ): array {

        $userIds = $entries->pluck('user_id')

            ->merge($overtimeRequests->pluck('user_id'))

            ->unique()

            ->values()

            ->all();



        if ($userIds === []) {

            return [];

        }



        $contractsByUser = $this->loadContractsForUsers($userIds, $periodEnd);



        $regularSecondsByUser = $entries->groupBy('user_id')->map(

            fn (Collection $userEntries) => (int) $userEntries->sum(

                fn (TimeEntry $entry) => (int) ($entry->duration ?? 0)

            )

        );



        $overtimeSecondsByUser = $overtimeRequests->groupBy('user_id')->map(

            fn (Collection $requests) => (int) $requests->sum('duration_seconds')

        );



        $records = [];



        foreach ($userIds as $userId) {

            $contract = $contractsByUser->get($userId);



            if (! $contract) {

                continue;

            }



            $regularSeconds = (int) ($regularSecondsByUser->get($userId) ?? 0);

            $overtimeSeconds = $settings->overtime_enabled

                ? (int) ($overtimeSecondsByUser->get($userId) ?? 0)

                : 0;

            $totalSeconds = $regularSeconds + $overtimeSeconds;



            $hourlyEquivalent = $this->effectiveHourlyRate($contract, $settings);

            $regularPay = $this->grossSalaryForPayableHours($regularSeconds, $contract, $settings);

            $overtimePay = $this->overtimePayForSeconds($overtimeSeconds, $contract, $settings);

            $gross = round($regularPay + $overtimePay, 2);



            $deductions = $this->deductionEngine->calculate($gross, $settings, [

                'user_id' => $userId,

                'payable_seconds' => $totalSeconds,

            ]);

            $componentTotals = $this->payrollComponents->totalsForGross($gross, $settings->organization_id);

            $bonuses = $componentTotals['increments'];

            $advanceDeduction = $this->salaryAdvances->pendingDeductionTotal($userId, $settings->organization_id);

            $totalDeductions = round($deductions->totalDeductions() + $componentTotals['deductions'] + $advanceDeduction, 2);

            $net = round($gross - $totalDeductions + $bonuses, 2);



            $records[] = [

                'user_id' => $userId,

                'salary_type' => $contract->salary_type->value,

                'payable_hours_seconds' => $totalSeconds,

                'regular_hours_seconds' => $regularSeconds,

                'regular_pay_snapshot' => number_format($regularPay, 2, '.', ''),

                'overtime_hours_seconds' => $overtimeSeconds,

                'overtime_rate_percent_snapshot' => $settings->overtime_enabled

                    ? $settings->overtime_rate_percentage

                    : null,

                'overtime_pay_snapshot' => number_format($overtimePay, 2, '.', ''),

                'hourly_equivalent_snapshot' => $hourlyEquivalent !== null ? round($hourlyEquivalent, 4) : null,

                'gross_salary_snapshot' => number_format($gross, 2, '.', ''),

                'deduction_mode_snapshot' => $settings->deduction_mode->value,

                'working_days_per_month_snapshot' => $settings->working_days_per_month,

                'working_hours_per_day_snapshot' => $settings->working_hours_per_day,

                'income_tax_percent_snapshot' => $settings->income_tax_percent,

                'eobi_percent_snapshot' => $settings->eobi_percent,

                'social_security_percent_snapshot' => $settings->social_security_percent,

                'custom_deduction_percent_snapshot' => $settings->custom_deduction_percent,

                'income_tax_snapshot' => number_format($deductions->incomeTax, 2, '.', ''),

                'eobi_snapshot' => number_format($deductions->eobi, 2, '.', ''),

                'social_security_snapshot' => number_format($deductions->socialSecurity, 2, '.', ''),

                'custom_deduction_snapshot' => number_format($deductions->customDeduction + $componentTotals['deductions'], 2, '.', ''),

                'bonuses_snapshot' => number_format($bonuses, 2, '.', ''),

                'advance_deduction_snapshot' => number_format($advanceDeduction, 2, '.', ''),

                'net_salary_snapshot' => number_format($net, 2, '.', ''),

            ];

        }



        return $records;

    }



    /**

     * @param  array<int, int>  $userIds

     * @return Collection<int, EmployeeSalaryContract>

     */

    private function loadContractsForUsers(array $userIds, Carbon $asOf): Collection

    {

        if ($userIds === []) {

            return collect();

        }



        return EmployeeSalaryContract::query()

            ->where('organization_id', TenantContext::id())

            ->whereIn('user_id', $userIds)

            ->where('is_active', true)

            ->whereDate('effective_from', '<=', $asOf->toDateString())

            ->where(function ($query) use ($asOf) {

                $query->whereNull('effective_to')

                    ->orWhereDate('effective_to', '>=', $asOf->toDateString());

            })

            ->orderByDesc('effective_from')

            ->get()

            ->unique('user_id')

            ->keyBy('user_id');

    }



    /**

     * @return array{hourly_rate_snapshot: float|null, pay_snapshot: float}

     */

    private function entryPaySnapshot(

        int $duration,

        ?EmployeeSalaryContract $contract,

        OrganizationPayrollSettings $settings

    ): array {

        if (! $contract) {

            return ['hourly_rate_snapshot' => null, 'pay_snapshot' => 0.0];

        }



        $rate = $this->effectiveHourlyRate($contract, $settings) ?? 0.0;

        $pay = $this->entryPay($duration, $contract, $settings);



        return [

            'hourly_rate_snapshot' => $rate > 0 ? round($rate, 2) : null,

            'pay_snapshot' => $pay,

        ];

    }

}

