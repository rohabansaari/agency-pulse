<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case SubAdmin = 'sub_admin';
    case Manager = 'manager';
    case Employee = 'employee';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Admin => 'Admin',
            self::SubAdmin => 'Sub Admin',
            self::Manager => 'Manager',
            self::Employee => 'Employee',
        };
    }

    public function isSuperAdmin(): bool
    {
        return $this === self::SuperAdmin;
    }

    /**
     * Roles that belong to an organization workforce.
     *
     * @return list<UserRole>
     */
    public static function organizationRoles(): array
    {
        return [
            self::Admin,
            self::SubAdmin,
            self::Manager,
            self::Employee,
        ];
    }

    public function isFullAdmin(): bool
    {
        return $this === self::Admin;
    }

    public function isOperationalAdmin(): bool
    {
        return $this === self::Admin || $this === self::SubAdmin;
    }

    public function canAccessPayroll(): bool
    {
        return $this === self::Admin;
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
