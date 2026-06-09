<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PayrollRunResource;
use App\Models\PayrollRun;
use App\Services\Payroll\PayrollRunService;
use App\Services\Payroll\PayrollVaultService;
use App\Support\DisplayDate;
use App\Support\ReportDateRange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PayrollRunController extends Controller
{
    public function __construct(
        private readonly PayrollRunService $payrollRuns,
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        [$rangeStart, $rangeEnd] = ReportDateRange::fromRequest($request, 'month');

        return PayrollRunResource::collection(
            $this->payrollRuns->listForOrganization($rangeStart, $rangeEnd)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'period_start' => ['required', 'regex:'.DisplayDate::INPUT_PATTERN],
            'period_end' => ['required', 'regex:'.DisplayDate::INPUT_PATTERN],
        ]);

        $run = $this->payrollRuns->create($request->user(), $validated);

        return response()->json([
            'message' => 'Payroll run created with snapshot totals.',
            'payroll_run' => new PayrollRunResource($run),
        ], 201);
    }

    public function show(PayrollRun $payrollRun): PayrollRunResource
    {
        return new PayrollRunResource($this->payrollRuns->show($payrollRun));
    }

    public function update(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'period_start' => ['sometimes', 'regex:'.DisplayDate::INPUT_PATTERN],
            'period_end' => ['sometimes', 'regex:'.DisplayDate::INPUT_PATTERN],
        ]);

        $run = $this->payrollRuns->update($payrollRun, $request->user(), $validated);

        return response()->json([
            'message' => 'Draft payroll run updated and recalculated.',
            'payroll_run' => new PayrollRunResource($run),
        ]);
    }

    public function destroy(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $this->payrollRuns->delete($payrollRun, $request->user());

        return response()->json([
            'message' => 'Draft payroll run deleted.',
        ]);
    }

    public function recalculate(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $run = $this->payrollRuns->recalculate($payrollRun, $request->user());

        return response()->json([
            'message' => 'Draft payroll run recalculated from current time data.',
            'payroll_run' => new PayrollRunResource($run),
        ]);
    }

    public function finalize(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $run = $this->payrollRuns->finalize($payrollRun, $request->user());

        return response()->json([
            'message' => 'Payroll run finalized. Time entries in this period are now locked.',
            'payroll_run' => new PayrollRunResource($run),
        ]);
    }

    public function lock(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $run = $this->payrollRuns->lock($payrollRun, $request->user());

        return response()->json([
            'message' => 'Payroll run locked.',
            'payroll_run' => new PayrollRunResource($run),
        ]);
    }
}
