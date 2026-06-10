<?php



namespace App\Http\Controllers\Api\V1;



use App\Enums\UserRole;

use App\Http\Controllers\Controller;

use App\Models\Project;

use App\Services\Reporting\ReportingService;

use App\Services\Tenant\TenantContext;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;

use App\Support\ReportDateRange;
use Illuminate\Validation\ValidationException;



class ReportController extends Controller

{

    public function __construct(

        private readonly ReportingService $reporting

    ) {}



    public function organization(Request $request): JsonResponse

    {

        if (! $request->user()?->currentRole()?->isOperationalAdmin()) {
            abort(403);
        }



        [$rangeStart, $rangeEnd] = ReportDateRange::fromRequest($request);

        return response()->json($this->reporting->organizationReport($rangeStart, $rangeEnd));

    }



    public function manager(Request $request): JsonResponse

    {

        $user = $request->user();



        if ($user?->currentRole() !== UserRole::Manager) {

            abort(403);

        }



        [$rangeStart, $rangeEnd] = ReportDateRange::fromRequest($request);

        return response()->json($this->reporting->managerReport($user, $rangeStart, $rangeEnd));

    }



    public function project(Request $request, Project $project): JsonResponse

    {

        if ($project->organization_id !== TenantContext::id()) {

            abort(404);

        }



        $role = $request->user()?->currentRole();



        [$rangeStart, $rangeEnd] = ReportDateRange::fromRequest($request);

        if ($role?->isOperationalAdmin()) {
            return response()->json($this->reporting->projectReport($project, $rangeStart, $rangeEnd));
        }



        if ($role === UserRole::Manager && $this->reporting->managerCanViewProject($request->user(), $project)) {

            return response()->json($this->reporting->projectReport($project, $rangeStart, $rangeEnd));

        }



        throw ValidationException::withMessages([

            'authorization' => ['You are not allowed to view project reports.'],

        ]);

    }

}

