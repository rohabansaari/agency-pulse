<?php

namespace App\Services\Time;

use App\Enums\LeaveCategory;
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
                'medical_limit_days' => 10,
                'medical_used_days' => 0,
                'casual_limit_days' => 10,
                'casual_used_days' => 0,
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

    public function setLimit(
        User $admin,
        User $target,
        LeaveCategory $category,
        int $limitDays,
    ): EmployeeLeaveBalance {
        $this->assertCanManage($admin);
        $this->ensureTargetInTenant($target);

        $balance = $this->balanceForUser($target);
        $column = match ($category) {
            LeaveCategory::Medical => 'medical_limit_days',
            LeaveCategory::Casual => 'casual_limit_days',
            LeaveCategory::Annual => 'annual_limit_days',
        };

        $balance->update([$column => max(0, $limitDays)]);

        return $balance->fresh();
    }

    public function resetBalance(
        User $admin,
        User $target,
        ?LeaveCategory $category = null,
    ): EmployeeLeaveBalance {
        $this->assertCanManage($admin);
        $this->ensureTargetInTenant($target);

        $balance = $this->balanceForUser($target);

        if ($category === null) {
            $balance->update([
                'medical_used_days' => 0,
                'casual_used_days' => 0,
                'used_days' => 0,
                'reset_at' => now(),
            ]);

            return $balance->fresh();
        }

        $usedColumn = match ($category) {
            LeaveCategory::Medical => 'medical_used_days',
            LeaveCategory::Casual => 'casual_used_days',
            LeaveCategory::Annual => 'used_days',
        };

        $balance->update([
            $usedColumn => 0,
            'reset_at' => now(),
        ]);

        return $balance->fresh();
    }

    public function consumeDays(User $user, float $days, LeaveCategory $category = LeaveCategory::Annual): void
    {
        if ($days <= 0) {
            return;
        }

        $balance = $this->balanceForUser($user);

        if ($balance->remainingDaysForCategory($category) < $days) {
            throw new HttpException(
                422,
                'Insufficient '.$category->label().' balance. Remaining: '
                .$balance->remainingDaysForCategory($category).' days.'
            );
        }

        $usedColumn = match ($category) {
            LeaveCategory::Medical => 'medical_used_days',
            LeaveCategory::Casual => 'casual_used_days',
            LeaveCategory::Annual => 'used_days',
        };

        $balance->update([
            $usedColumn => round($balance->usedDaysForCategory($category) + $days, 2),
        ]);
    }

    public function refundDays(User $user, float $days, LeaveCategory $category = LeaveCategory::Annual): void
    {
        if ($days <= 0) {
            return;
        }

        $balance = $this->balanceForUser($user);
        $usedColumn = match ($category) {
            LeaveCategory::Medical => 'medical_used_days',
            LeaveCategory::Casual => 'casual_used_days',
            LeaveCategory::Annual => 'used_days',
        };

        $balance->update([
            $usedColumn => max(0, round($balance->usedDaysForCategory($category) - $days, 2)),
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
