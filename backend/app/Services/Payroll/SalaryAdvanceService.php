<?php

namespace App\Services\Payroll;

use App\Enums\AdvanceRequestStatus;
use App\Enums\UserRole;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\HttpException;

class SalaryAdvanceService
{
    /**
     * @return Collection<int, SalaryAdvanceRequest>
     */
    public function listForUser(User $user): Collection
    {
        $query = SalaryAdvanceRequest::query()
            ->where('organization_id', TenantContext::id())
            ->with(['user', 'reviewer'])
            ->orderByDesc('created_at');

        if ($user->currentRole() === UserRole::Admin) {
            return $query->get();
        }

        return $query->where('user_id', $user->id)->get();
    }

    /**
     * @return Collection<int, SalaryAdvanceRequest>
     */
    public function pendingForAdmin(): Collection
    {
        return SalaryAdvanceRequest::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', AdvanceRequestStatus::Pending)
            ->with(['user'])
            ->orderBy('created_at')
            ->get();
    }

    public function create(User $user, array $validated): SalaryAdvanceRequest
    {
        $role = $user->currentRole();

        if (! in_array($role, [UserRole::Employee, UserRole::Manager], true)) {
            throw new HttpException(403, 'Only employees and managers can request salary advances.');
        }

        return SalaryAdvanceRequest::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $user->id,
            'amount' => $validated['amount'],
            'reason' => $validated['reason'] ?? null,
            'status' => AdvanceRequestStatus::Pending,
        ]);
    }

    public function approve(User $admin, SalaryAdvanceRequest $request): SalaryAdvanceRequest
    {
        $this->ensureInTenant($request);

        if ($request->status !== AdvanceRequestStatus::Pending) {
            throw new HttpException(422, 'This advance request has already been reviewed.');
        }

        $request->update([
            'status' => AdvanceRequestStatus::Approved,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        return $request->fresh(['user', 'reviewer']);
    }

    public function reject(User $admin, SalaryAdvanceRequest $request): SalaryAdvanceRequest
    {
        $this->ensureInTenant($request);

        if ($request->status !== AdvanceRequestStatus::Pending) {
            throw new HttpException(422, 'This advance request has already been reviewed.');
        }

        $request->update([
            'status' => AdvanceRequestStatus::Rejected,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        return $request->fresh(['user', 'reviewer']);
    }

    /**
     * Total approved-but-not-yet-deducted advances for a user.
     */
    public function pendingDeductionTotal(int $userId, ?int $organizationId = null): float
    {
        $organizationId ??= TenantContext::id();

        return (float) SalaryAdvanceRequest::query()
            ->where('organization_id', $organizationId)
            ->where('user_id', $userId)
            ->where('status', AdvanceRequestStatus::Approved)
            ->sum('amount');
    }

    /**
     * Mark approved advances as deducted for a payroll run.
     *
     * @return float Total advance amount deducted
     */
    public function deductApprovedForPayroll(int $userId, int $payrollRunId, ?int $organizationId = null): float
    {
        $organizationId ??= TenantContext::id();

        $requests = SalaryAdvanceRequest::query()
            ->where('organization_id', $organizationId)
            ->where('user_id', $userId)
            ->where('status', AdvanceRequestStatus::Approved)
            ->get();

        $total = 0.0;

        foreach ($requests as $request) {
            $total += (float) $request->amount;
            $request->update([
                'status' => AdvanceRequestStatus::Deducted,
                'deducted_at' => now(),
                'payroll_run_id' => $payrollRunId,
            ]);
        }

        return round($total, 2);
    }

    private function ensureInTenant(SalaryAdvanceRequest $request): void
    {
        if ($request->organization_id !== TenantContext::id()) {
            abort(404);
        }
    }
}
