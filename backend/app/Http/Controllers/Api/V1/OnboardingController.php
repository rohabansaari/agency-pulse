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
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OnboardingController extends TenantController
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
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'website' => ['nullable', 'url', 'max:2048'],
        ]);

        $organization = $this->onboarding->updateOrganization(TenantContext::get(), $validated);

        return response()->json([
            'message' => 'Organization profile saved.',
            'status' => $this->onboarding->status($request->user(), $organization),
        ]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'logo' => ['required', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:2048'],
        ]);

        $organization = TenantContext::get();
        $file = $validated['logo'];
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension());
        $path = $file->storeAs(
            'organization-logos',
            "{$organization->id}.{$extension}",
            'public'
        );

        $logoUrl = rtrim((string) config('app.url'), '/').Storage::disk('public')->url($path);

        $organization = $this->onboarding->updateOrganization($organization, [
            'name' => $organization->name,
            'timezone' => $organization->timezone,
            'logo_url' => $logoUrl,
            'website' => $organization->website,
        ]);

        return response()->json([
            'message' => 'Logo uploaded.',
            'logo_url' => $logoUrl,
            'status' => $this->onboarding->status($request->user(), $organization),
        ]);
    }

    public function updateStep(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1', 'max:5'],
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
        $organization = $this->onboarding->markStepCompleted(TenantContext::get(), 3);

        return response()->json([
            'message' => $result['message'],
            'member' => new TeamMemberResource($result['member']),
            'status' => $this->onboarding->status($request->user(), $organization),
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
        $organization = $result['created'] > 0
            ? $this->onboarding->markStepCompleted(TenantContext::get(), 3)
            : TenantContext::get();

        return response()->json([
            'message' => $result['message'],
            'created' => $result['created'],
            'failed_count' => $result['failed_count'],
            'total' => $result['total'],
            'failed' => $result['failed'],
            'results' => $result['results'],
            'status' => $this->onboarding->status($request->user(), TenantContext::get()),
        ]);
    }

    public function sampleCsv(Request $request): StreamedResponse
    {
        $this->ensureAdmin($request);

        $headers = ['name', 'email', 'salary', 'salary_type', 'role'];
        $rows = [
            ['John Doe', 'john@example.com', '100000', 'monthly', 'employee'],
            ['Jane Smith', 'jane@example.com', '1200', 'hourly', 'manager'],
            ['Mark Wilson', 'mark@example.com', '85000', 'monthly', 'sub_admin'],
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

    public function skipStep(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'step' => ['required', 'integer', Rule::in([3, 4, 5])],
        ]);

        $organization = $this->onboarding->markStepSkipped(
            TenantContext::get(),
            (int) $validated['step']
        );

        return response()->json([
            'status' => $this->onboarding->status($request->user(), $organization),
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

    public function updateStepCompletion(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1', 'max:5'],
            'completed' => ['required', 'boolean'],
        ]);

        $organization = $this->onboarding->setStepCompletion(
            TenantContext::get(),
            (int) $validated['step'],
            (bool) $validated['completed'],
        );

        return response()->json([
            'message' => 'Onboarding step updated.',
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
