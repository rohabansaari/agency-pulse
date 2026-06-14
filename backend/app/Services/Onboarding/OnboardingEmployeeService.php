<?php

namespace App\Services\Onboarding;

use App\Enums\OrganizationMemberStatus;
use App\Enums\SalaryType;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\InvitationService;
use App\Services\Auth\MembershipRoleSync;
use App\Services\Auth\RoleMutationGuard;
use App\Services\Payroll\AdminPayrollService;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class OnboardingEmployeeService
{
    /** @var list<string> */
    public const SUPPORTED_COLUMNS = ['name', 'email', 'salary', 'salary_type', 'role'];

    /** @var list<string> */
    public const ALLOWED_CSV_ROLES = ['employee', 'manager', 'sub_admin'];

    public const DISALLOWED_ROLE_MESSAGE = 'CSV import supports only employee, manager, and sub_admin roles.';

    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync,
        private readonly AdminPayrollService $adminPayroll,
        private readonly InvitationService $invitations,
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     * @return array{member: OrganizationMember, message: string}
     */
    public function createEmployee(array $validated, User $admin): array
    {
        $role = UserRole::tryFrom($validated['role'] ?? UserRole::Employee->value) ?? UserRole::Employee;
        RoleMutationGuard::assertPrivilegedRoleAssignable($admin, $role);

        $organization = Organization::query()->findOrFail(TenantContext::id());

        $bundle = DB::transaction(function () use ($validated, $admin, $role, $organization) {
            $pending = $this->invitations->createPendingMember(
                $organization,
                $validated['name'],
                $validated['email'],
                $role,
            );

            $contractPayload = $this->contractPayloadFromSalary($validated);
            $this->adminPayroll->createInitialContract($pending['user'], $contractPayload, $admin);

            $plainToken = $this->invitations->issueToken($pending['user'], $organization, resent: false);

            return [
                'membership' => $pending['membership'],
                'plain_token' => $plainToken,
            ];
        });

        $emailSent = $this->invitations->trySendInvitationEmail(
            $bundle['membership']->user,
            $organization,
            $bundle['plain_token'],
        );

        return [
            'member' => $bundle['membership'],
            'message' => $emailSent
                ? 'Employee invited. An activation email was sent.'
                : 'Employee invited. The activation email could not be sent — resend the invitation from the team page.',
        ];
    }

    /**
     * @return array{
     *     created: int,
     *     failed_count: int,
     *     total: int,
     *     failed: list<array{row: int, data: array<string, string>, errors: list<string>}>,
     *     results: list<array{row: int, data: array<string, string>, status: string, error: string|null}>,
     *     message: string
     * }
     */
    public function importCsv(string $csvContent, User $admin): array
    {
        $lines = preg_split('/\R/', trim($csvContent)) ?: [];
        if ($lines === []) {
            throw ValidationException::withMessages([
                'file' => ['CSV file is empty.'],
            ]);
        }

        $header = str_getcsv(array_shift($lines));
        $normalizedHeader = array_map(fn (string $column) => strtolower(trim($column)), $header);

        foreach (self::SUPPORTED_COLUMNS as $requiredColumn) {
            if (! in_array($requiredColumn, $normalizedHeader, true)) {
                throw ValidationException::withMessages([
                    'file' => ['CSV must include columns: '.implode(', ', self::SUPPORTED_COLUMNS).". Missing: {$requiredColumn}"],
                ]);
            }
        }

        $created = 0;
        $failed = [];
        $results = [];
        $seenEmails = [];
        $total = 0;

        foreach ($lines as $index => $line) {
            if (trim($line) === '') {
                continue;
            }

            $total++;
            $rowNumber = $index + 2;
            $values = str_getcsv($line);
            $fullRow = [];
            $supportedRow = [];

            foreach ($header as $position => $originalColumn) {
                $value = trim((string) ($values[$position] ?? ''));
                $fullRow[$originalColumn] = $value;

                $normalized = strtolower(trim($originalColumn));
                if (in_array($normalized, self::SUPPORTED_COLUMNS, true)) {
                    $supportedRow[$normalized] = $value;
                }
            }

            $errors = $this->validateImportRow($supportedRow, $seenEmails);

            if ($errors !== []) {
                $errorMessage = implode('; ', $errors);
                $failed[] = [
                    'row' => $rowNumber,
                    'data' => $fullRow,
                    'errors' => $errors,
                ];
                $results[] = [
                    'row' => $rowNumber,
                    'data' => $fullRow,
                    'status' => 'failed',
                    'error' => $errorMessage,
                ];

                continue;
            }

            $emailKey = strtolower($supportedRow['email']);
            $seenEmails[$emailKey] = $rowNumber;

            try {
                $this->createEmployee([
                    'name' => $supportedRow['name'],
                    'email' => $supportedRow['email'],
                    'salary_type' => $supportedRow['salary_type'],
                    'salary' => $supportedRow['salary'],
                    'role' => $supportedRow['role'],
                ], $admin);

                $created++;
                $results[] = [
                    'row' => $rowNumber,
                    'data' => $fullRow,
                    'status' => 'imported',
                    'error' => null,
                ];
            } catch (Throwable $exception) {
                $errors = $this->errorsFromThrowable($exception);
                $errorMessage = implode('; ', $errors);
                $failed[] = [
                    'row' => $rowNumber,
                    'data' => $fullRow,
                    'errors' => $errors,
                ];
                $results[] = [
                    'row' => $rowNumber,
                    'data' => $fullRow,
                    'status' => 'failed',
                    'error' => $errorMessage,
                ];
            }
        }

        $failedCount = count($failed);
        $message = $failedCount === 0
            ? "{$created} employee invitation(s) sent."
            : "{$created} employee invitation(s) sent. {$failedCount} record(s) require attention.";

        return [
            'created' => $created,
            'failed_count' => $failedCount,
            'total' => $total,
            'failed' => $failed,
            'results' => $results,
            'message' => $message,
        ];
    }

    /**
     * @param  array<string, string>  $row
     * @param  array<string, int>  $seenEmails
     * @return list<string>
     */
    private function validateImportRow(array $row, array $seenEmails): array
    {
        $errors = [];

        try {
            validator($row, [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'salary' => ['required', 'numeric', 'min:0'],
                'salary_type' => ['required', Rule::in([SalaryType::Hourly->value, SalaryType::Monthly->value])],
                'role' => ['required', 'string'],
            ])->validate();
        } catch (ValidationException $exception) {
            $errors = array_merge($errors, collect($exception->errors())->flatten()->values()->all());
        }

        $role = strtolower(trim($row['role'] ?? ''));
        if ($role !== '' && ! in_array($role, self::ALLOWED_CSV_ROLES, true)) {
            $errors[] = self::DISALLOWED_ROLE_MESSAGE;
        }

        $email = strtolower(trim($row['email'] ?? ''));
        if ($email !== '' && isset($seenEmails[$email])) {
            $errors[] = 'Duplicate email in file.';
        }

        return array_values(array_unique($errors));
    }

    /**
     * @return list<string>
     */
    private function errorsFromThrowable(Throwable $exception): array
    {
        if ($exception instanceof ValidationException) {
            return collect($exception->errors())->flatten()->values()->all();
        }

        if ($exception instanceof HttpException) {
            return [$exception->getMessage()];
        }

        return ['Unable to import this row.'];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function contractPayloadFromSalary(array $validated): array
    {
        $salaryType = SalaryType::from($validated['salary_type']);
        $salary = (string) $validated['salary'];

        return match ($salaryType) {
            SalaryType::Hourly => [
                'salary_type' => SalaryType::Hourly->value,
                'hourly_rate' => $salary,
            ],
            SalaryType::Monthly => [
                'salary_type' => SalaryType::Monthly->value,
                'monthly_salary' => $salary,
            ],
        };
    }
}
