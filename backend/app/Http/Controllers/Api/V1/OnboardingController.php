<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SalaryType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TeamMemberResource;
use App\Services\Onboarding\OnboardingEmployeeService;
use App\Services\Onboarding\OnboardingService;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OnboardingController extends Controller
{
    public function __construct(
        private readonly OnboardingService $onboarding,
        private readonly OnboardingEmployeeService $onboardingEmployees
    ) {}

    public function status(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json(
            $this->onboarding->status($request->user(), TenantContext::get())
        );
    }

    public function updateOrganization(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'timezone' => ['nullable', 'string', 'max:100'],
            'logo_url' => ['nullable', 'url', 'max:2048'],
            'website' => ['nullable', 'url', 'max:2048'],
        ]);

        $organization = $this->onboarding->updateOrganization(TenantContext::get(), $validated);

        return response()->json([
            'message' => 'Organization profile saved.',
            'status' => $this->onboarding->status($request->user(), $organization),
        ]);
    }

    public function updateStep(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1', 'max:6'],
        ]);

        $organization = $this->onboarding->updateStep(
            TenantContext::get(),
            (int) $validated['step']
        );

        return response()->json([
            'status' => $this->onboarding->status($request->user(), $organization),
        ]);
    }

    public function storeEmployee(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'salary' => ['required', 'numeric', 'min:0'],
            'salary_type' => ['required', Rule::enum(SalaryType::class)],
            'role' => ['sometimes', Rule::enum(UserRole::class), Rule::notIn([UserRole::SuperAdmin->value])],
        ]);

        $result = $this->onboardingEmployees->createEmployee($validated, $request->user());

        return response()->json([
            'message' => $result['message'],
            'member' => new TeamMemberResource($result['member']),
            'status' => $this->onboarding->status($request->user(), TenantContext::get()),
        ], 201);
    }

    public function importEmployees(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $csvContent = (string) file_get_contents($validated['file']->getRealPath());
        $result = $this->onboardingEmployees->importCsv($csvContent, $request->user());

        return response()->json([
            'message' => $result['message'],
            'created' => $result['created'],
            'failed' => $result['failed'],
            'status' => $this->onboarding->status($request->user(), TenantContext::get()),
        ]);
    }

    public function sampleCsv(Request $request): StreamedResponse
    {
        $this->ensureAdmin($request);

        $headers = ['name', 'email', 'salary', 'salary_type'];
        $rows = [
            ['Jane Doe', 'jane@example.com', '5000', 'monthly'],
            ['John Smith', 'john@example.com', '35', 'hourly'],
        ];

        return response()->streamDownload(function () use ($headers, $rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, 'employee-import-sample.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function complete(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $organization = $this->onboarding->tryMarkComplete(TenantContext::get());

        if (! $organization->onboarding_completed) {
            return response()->json([
                'message' => 'Organization name and payroll PIN are required before finishing onboarding.',
                'status' => $this->onboarding->status($request->user(), $organization),
            ], 422);
        }

        return response()->json([
            'message' => 'Onboarding completed.',
            'status' => $this->onboarding->status($request->user(), $organization),
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        if ($request->user()?->currentRole() !== UserRole::Admin) {
            abort(403);
        }
    }
}
