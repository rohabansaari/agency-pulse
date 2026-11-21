<?php

namespace App\Services\Payroll;

use App\Enums\PayrollRunStatus;
use App\Mail\PayslipReadyMail;
use App\Models\Organization;
use App\Models\PayrollRun;
use App\Models\PayrollRunEmployeeRecord;
use App\Models\User;
use App\Services\Invoicing\InvoiceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Payslips are the employee records of finalized or locked payroll runs,
 * shown as earnings and deductions lines that add up to net pay.
 */
class PayslipService
{
    private const ISSUED_STATUSES = [PayrollRunStatus::Finalized, PayrollRunStatus::Locked];

    /** @return array<int, array<string, mixed>> */
    public function listForUser(User $user, int $organizationId): array
    {
        return $this->issued($organizationId)
            ->where('user_id', $user->id)
            ->get()
            ->sortByDesc(fn (PayrollRunEmployeeRecord $record) => $record->payrollRun->period_end)
            ->values()
            ->map(fn (PayrollRunEmployeeRecord $record) => [
                'id' => $record->id,
                'period_start' => $record->payrollRun->period_start->toDateString(),
                'period_end' => $record->payrollRun->period_end->toDateString(),
                'period_label' => $this->periodLabel($record->payrollRun),
                'pay_date' => $record->payrollRun->finalized_at?->toDateString(),
                'net_pay' => (float) $record->net_salary_snapshot,
                'currency' => 'PKR',
            ])
            ->all();
    }

    public function findIssued(int $recordId, int $organizationId): ?PayrollRunEmployeeRecord
    {
        return $this->issued($organizationId)->whereKey($recordId)->first();
    }

    /** @return array<string, mixed> */
    public function payslip(PayrollRunEmployeeRecord $record): array
    {
        $run = $record->payrollRun;
        $organization = $run->organization;
        $invoiceSettings = array_merge(InvoiceService::DEFAULT_SETTINGS, $organization->invoice_settings ?? []);
        $lines = collect($record->adjustment_lines_snapshot ?? []);

        $regularHours = round($record->regular_hours_seconds / 3600, 2);
        $earnings = [[
            'name' => $record->salary_type === 'hourly' ? "Hours worked ({$regularHours} h)" : 'Basic salary',
            'amount' => (float) $record->regular_pay_snapshot,
        ]];

        if ((float) $record->overtime_pay_snapshot > 0) {
            $overtimeHours = round($record->overtime_hours_seconds / 3600, 2);
            $earnings[] = [
                'name' => "Overtime ({$overtimeHours} h at ".rtrim(rtrim((string) $record->overtime_rate_percent_snapshot, '0'), '.').'%)',
                'amount' => (float) $record->overtime_pay_snapshot,
            ];
        }

        foreach ($lines->where('type', 'increment') as $line) {
            $earnings[] = ['name' => (string) $line['name'], 'amount' => round((float) $line['amount'], 2)];
        }

        $deductions = $lines->where('type', 'deduction')
            ->map(fn (array $line) => ['name' => (string) $line['name'], 'amount' => round((float) $line['amount'], 2)])
            ->values()
            ->all();

        $totalEarnings = round(array_sum(array_column($earnings, 'amount')), 2);
        $net = round((float) $record->net_salary_snapshot, 2);
        $totalDeductions = round($totalEarnings - $net, 2);

        // Older runs may not carry every line; keep the slip adding up to the net that was paid.
        $unlisted = round($totalDeductions - array_sum(array_column($deductions, 'amount')), 2);
        if (abs($unlisted) >= 0.01) {
            $deductions[] = ['name' => 'Other deductions', 'amount' => $unlisted];
        }

        return [
            'id' => $record->id,
            'status' => $run->status->value,
            'period_start' => $run->period_start->toDateString(),
            'period_end' => $run->period_end->toDateString(),
            'period_label' => $this->periodLabel($run),
            'pay_date' => $run->finalized_at?->toDateString(),
            'currency' => 'PKR',
            'company' => [
                'name' => $invoiceSettings['business_name'] ?: $organization->name,
                'address' => (string) $invoiceSettings['address'],
                'logo_url' => $organization->logo_url,
            ],
            'employee' => [
                'id' => $record->user_id,
                'name' => $record->user?->name,
                'email' => $record->user?->email,
            ],
            'salary_type' => $record->salary_type,
            'hours' => [
                'payable_seconds' => $record->payable_hours_seconds,
                'regular_seconds' => $record->regular_hours_seconds,
                'overtime_seconds' => $record->overtime_hours_seconds,
            ],
            'earnings' => $earnings,
            'deductions' => $deductions,
            'total_earnings' => $totalEarnings,
            'total_deductions' => $totalDeductions,
            'net_pay' => $net,
        ];
    }

    /**
     * Tell each paid employee their payslip is ready. The email carries a link
     * only, never amounts. Failures are logged and never block payroll.
     *
     * @return int emails sent
     */
    public function sendReadyEmails(PayrollRun $run): int
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $sent = 0;

        $run->loadMissing(['employeeRecords.user', 'organization']);

        foreach ($run->employeeRecords as $record) {
            $user = $record->user;
            if (! $user || ! filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }

            try {
                Mail::to($user->email, $user->name)->send(new PayslipReadyMail(
                    $user,
                    $run->organization,
                    $this->periodLabel($run),
                    "{$frontend}/payslips/{$record->id}",
                ));
                $sent++;
            } catch (\Throwable $exception) {
                Log::warning('Payslip email send failed.', [
                    'payroll_run_id' => $run->id,
                    'user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $sent;
    }

    public function periodLabel(PayrollRun $run): string
    {
        $start = $run->period_start;
        $end = $run->period_end;

        if ($start->isSameDay($start->copy()->startOfMonth()) && $end->isSameDay($start->copy()->endOfMonth())) {
            return $start->format('F Y');
        }

        return $start->format('j M Y').' – '.$end->format('j M Y');
    }

    private function issued(int $organizationId): Builder
    {
        return PayrollRunEmployeeRecord::query()
            ->with(['payrollRun', 'user'])
            ->whereHas('payrollRun', fn (Builder $query) => $query
                ->withoutGlobalScope('organization')
                ->where('organization_id', $organizationId)
                ->whereIn('status', array_map(fn (PayrollRunStatus $status) => $status->value, self::ISSUED_STATUSES)));
    }
}
