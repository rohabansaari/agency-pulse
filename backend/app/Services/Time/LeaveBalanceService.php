<?php

namespace App\Services\Time;

use App\Enums\UserRole;
use App\Models\EmployeeLeaveBalance;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\HttpException;

class LeaveBalanceService
{
    public function balanceForUser(User $user): EmployeeLeaveBalance
    {
        return EmployeeLeaveBalance::query()->firstOrCreate(
            [
                'organization_id' => TenantContext::id(),
                'user_id' => $user->id,
            ],
            [
                'annual_limit_days' => 20,
                'used_days' => 0,
            ]
        );
    }

    /**
     * @return Collection<int, array{user: User, balance: EmployeeLeaveBalance}>
     */
    public function allBalances(): Collection
    {
        $members = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->whereIn('role', [UserRole::Employee, UserRole::Manager])
            ->with('user')
            ->get();

        return $members->map(function (OrganizationMember $member) {
            $balance = $this->balanceForUser($member->user);

            return [
                'user' => $member->user,
                'balance' => $balance,
            ];
        });
    }

    public function setLimit(User $admin, User $target, int $limitDays): EmployeeLeaveBalance
    {
        $this->assertCanManage($admin);
        $this->ensureTargetInTenant($target);

        $balance = $this->balanceForUser($target);
        $balance->update(['annual_limit_days' => max(0, $limitDays)]);

        return $balance->fresh();
    }

    public function resetBalance(User $admin, User $target): EmployeeLeaveBalance
    {
        $this->assertCanManage($admin);
        $this->ensureTargetInTenant($target);

        $balance = $this->balanceForUser($target);
        $balance->update([
            'used_days' => 0,
            'reset_at' => now(),
        ]);

        return $balance->fresh();
    }

    public function consumeDays(User $user, float $days): void
    {
        if ($days <= 0) {
            return;
        }

        $balance = $this->balanceForUser($user);

        if ($balance->remainingDays() < $days) {
            throw new HttpException(422, 'Insufficient leave balance. Remaining: '.$balance->remainingDays().' days.');
        }

        $balance->update([
            'used_days' => round((float) $balance->used_days + $days, 2),
        ]);
    }

    public function refundDays(User $user, float $days): void
    {
        if ($days <= 0) {
            return;
        }

        $balance = $this->balanceForUser($user);
        $balance->update([
            'used_days' => max(0, round((float) $balance->used_days - $days, 2)),
        ]);
    }

    private function assertCanManage(User $admin): void
    {
        if (! $admin->currentRole()?->isOperationalAdmin()) {
            throw new HttpException(403, 'Only admins can manage leave limits.');
        }
    }

    private function ensureTargetInTenant(User $target): void
    {
        $role = $target->currentRole();

        if (! in_array($role, [UserRole::Employee, UserRole::Manager], true)) {
            throw new HttpException(422, 'Leave limits apply to employees and managers only.');
        }

        $exists = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $target->id)
            ->exists();

        if (! $exists) {
            abort(404);
        }
    }
}
