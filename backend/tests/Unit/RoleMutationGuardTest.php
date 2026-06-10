<?php

namespace Tests\Unit;

use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\RoleMutationGuard;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RoleMutationGuardTest extends TestCase
{
    public function test_admin_and_sub_admin_roles_are_immutable(): void
    {
        $this->assertFalse(RoleMutationGuard::isMutableRole(UserRole::Admin));
        $this->assertFalse(RoleMutationGuard::isMutableRole(UserRole::SubAdmin));
        $this->assertTrue(RoleMutationGuard::isMutableRole(UserRole::Employee));
        $this->assertTrue(RoleMutationGuard::isMutableRole(UserRole::Manager));
    }

    public function test_employee_and_manager_roles_can_be_swapped(): void
    {
        $admin = $this->createMock(User::class);
        $admin->method('currentRole')->willReturn(UserRole::Admin);
        $admin->id = 1;

        $member = new OrganizationMember([
            'user_id' => 2,
            'role' => UserRole::Employee,
        ]);

        RoleMutationGuard::assertRoleChangeAllowed($admin, $member, UserRole::Manager);

        $this->expectNotToPerformAssertions();
    }

    public function test_cannot_promote_employee_to_admin_after_creation(): void
    {
        $admin = $this->createMock(User::class);
        $admin->method('currentRole')->willReturn(UserRole::Admin);
        $admin->id = 1;

        $member = new OrganizationMember([
            'user_id' => 2,
            'role' => UserRole::Employee,
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Roles can only be changed between employee and manager.');

        RoleMutationGuard::assertRoleChangeAllowed($admin, $member, UserRole::Admin);
    }

    public function test_cannot_change_sub_admin_role_after_creation(): void
    {
        $admin = $this->createMock(User::class);
        $admin->method('currentRole')->willReturn(UserRole::Admin);
        $admin->id = 1;

        $member = new OrganizationMember([
            'user_id' => 2,
            'role' => UserRole::SubAdmin,
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Admin and sub admin roles cannot be changed after creation.');

        RoleMutationGuard::assertRoleChangeAllowed($admin, $member, UserRole::Employee);
    }
}
