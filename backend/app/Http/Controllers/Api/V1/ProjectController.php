<?php



namespace App\Http\Controllers\Api\V1;



use App\Enums\ProjectStatus;

use App\Enums\UserRole;

use App\Http\Controllers\Controller;

use App\Http\Resources\ProjectResource;

use App\Models\Project;

use App\Services\Projects\ProjectAccessService;

use App\Services\Tenant\TenantContext;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

use Illuminate\Validation\Rule;

use Illuminate\Validation\ValidationException;



class ProjectController extends TenantAppController
{
    public function __construct(
        private readonly ProjectAccessService $projectAccess
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $query = $this->projectAccess->accessibleProjectsQuery($user)->withCount('members');



        if ($request->boolean('include_archived') && $user->currentRole()?->isOperationalAdmin()) {

            // all statuses

        } else {

            $query->where('status', '!=', ProjectStatus::Archived);

        }



        $projects = $query->orderBy('name')->get();



        return ProjectResource::collection($projects);

    }



    public function store(Request $request): JsonResponse

    {

        $this->authorizeProjectManagement($request);



        $validated = $this->validateProjectPayload($request);



        $project = Project::create([

            ...$validated,

            'organization_id' => TenantContext::id(),

            'status' => $validated['status'] ?? ProjectStatus::Active,

        ]);



        return response()->json([

            'message' => 'Project created.',

            'project' => new ProjectResource($project->loadCount('members')),

        ], 201);

    }



    public function show(Request $request, Project $project): ProjectResource|JsonResponse

    {

        $this->authorizeProjectAccess($request, $project);



        $project->loadCount('members');

        $project->loadSum(

            ['timeEntries as total_tracked_seconds' => fn ($q) => $q->countable()],

            'duration'

        );



        return new ProjectResource($project);

    }



    public function update(Request $request, Project $project): JsonResponse

    {

        $this->authorizeProjectManagement($request);

        $this->ensureProjectInTenant($project);



        $validated = $this->validateProjectPayload($request, isUpdate: true);



        $project->update($validated);



        return response()->json([

            'message' => 'Project updated.',

            'project' => new ProjectResource($project->fresh()->loadCount('members')),

        ]);

    }



    public function updateStatus(Request $request, Project $project): JsonResponse

    {

        $this->authorizeProjectManagement($request);

        $this->ensureProjectInTenant($project);



        $role = $request->user()->currentRole();



        $allowedStatuses = $role?->isOperationalAdmin()
            ? ProjectStatus::cases()
            : [ProjectStatus::Active, ProjectStatus::Inactive];



        $validated = $request->validate([

            'status' => [

                'required',

                Rule::in(array_map(fn (ProjectStatus $s) => $s->value, $allowedStatuses)),

            ],

        ]);



        $project->update(['status' => $validated['status']]);



        return response()->json([

            'message' => 'Project status updated.',

            'project' => new ProjectResource($project->fresh()->loadCount('members')),

        ]);

    }



    /**

     * @return array<string, mixed>

     */

    private function validateProjectPayload(Request $request, bool $isUpdate = false): array

    {

        $role = $request->user()->currentRole();

        $isAdmin = $role?->isFullAdmin() ?? false;
        $canArchive = $role?->isOperationalAdmin() ?? false;



        if ($request->has('hourly_rate') && ! $isAdmin) {

            throw ValidationException::withMessages([

                'hourly_rate' => ['You are not allowed to set or modify hourly rates.'],

            ]);

        }



        $rules = [

            'name' => [$isUpdate ? 'sometimes' : 'required', 'required', 'string', 'max:255'],

            'client_name' => [$isUpdate ? 'sometimes' : 'required', 'required', 'string', 'max:255'],

            'description' => ['nullable', 'string', 'max:5000'],

            'status' => ['nullable', Rule::enum(ProjectStatus::class)],

        ];



        if ($isAdmin) {

            $rules['hourly_rate'] = ['nullable', 'numeric', 'min:0'];

        }



        $validated = $request->validate($rules);



        if (! $isAdmin) {

            unset($validated['hourly_rate']);

        }



        if (isset($validated['status']) && $validated['status'] === ProjectStatus::Archived->value && ! $canArchive) {
            throw ValidationException::withMessages([
                'status' => ['Only operational admins can archive projects.'],
            ]);
        }



        return $validated;

    }



    private function authorizeProjectManagement(Request $request): void

    {

        $role = $request->user()?->currentRole();



        if (! in_array($role, [UserRole::Admin, UserRole::SubAdmin, UserRole::Manager], true)) {
            throw ValidationException::withMessages([
                'authorization' => ['You are not allowed to manage projects.'],
            ]);
        }

    }



    private function authorizeProjectAccess(Request $request, Project $project): void

    {

        $this->ensureProjectInTenant($project);



        $user = $request->user();



        if (in_array($user->currentRole(), [UserRole::Admin, UserRole::SubAdmin, UserRole::Manager], true)) {
            return;
        }



        if (! $this->projectAccess->userCanAccessProject($user, $project)) {
            abort(404);
        }

    }



    private function ensureProjectInTenant(Project $project): void

    {

        if ($project->organization_id !== TenantContext::id()) {

            abort(404);

        }

    }

}

