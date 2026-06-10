<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScreenshotResource;
use App\Models\Project;
use App\Models\Screenshot;
use App\Support\ReportDateRange;
use App\Services\Projects\ProjectAccessService;
use App\Services\Screenshots\ScreenshotAccessService;
use App\Services\Screenshots\ScreenshotStorageService;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ScreenshotController extends Controller
{
    public function __construct(
        private readonly ScreenshotStorageService $storage,
        private readonly ScreenshotAccessService $access,
        private readonly ProjectAccessService $projectAccess
    ) {}

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->can('screenshots.upload')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'image' => ['required', 'string'],
            'timestamp' => ['required', 'date'],
            'session_id' => ['required', 'uuid'],
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id')->where(
                    fn ($query) => $query->where('organization_id', TenantContext::id())
                ),
            ],
        ]);

        if (isset($validated['project_id'])) {
            $project = Project::query()->findOrFail($validated['project_id']);

            if (! $this->projectAccess->userCanAccessProject($user, $project)) {
                throw ValidationException::withMessages([
                    'project_id' => ['You are not assigned to this project.'],
                ]);
            }
        }

        try {
            [$binary, $extension] = $this->storage->decodePayload($validated['image']);
            [$binary, $extension] = $this->storage->compressIfNeeded($binary, $extension);
        } catch (\Throwable $exception) {
            throw ValidationException::withMessages([
                'image' => ['Invalid screenshot image payload.'],
            ]);
        }

        $maxBytes = (int) config('screenshots.max_upload_kb', 5120) * 1024;

        if (strlen($binary) > $maxBytes) {
            throw ValidationException::withMessages([
                'image' => ['Screenshot exceeds maximum upload size.'],
            ]);
        }

        $stored = $this->storage->store(
            TenantContext::id(),
            $user->id,
            $binary,
            $extension
        );

        $screenshot = Screenshot::query()->create([
            'user_id' => $user->id,
            'project_id' => $validated['project_id'] ?? null,
            'session_id' => $validated['session_id'],
            'storage_disk' => $stored['disk'],
            'image_path' => $stored['path'],
            'file_size_bytes' => $stored['size'],
            'captured_at' => Carbon::parse($validated['timestamp']),
        ]);

        $screenshot->load(['user', 'project']);

        return response()->json([
            'screenshot' => ScreenshotResource::make($screenshot),
        ], 201);
    }

    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $user = $request->user();

        if (! $user->can('screenshots.view') && ! $user->can('screenshots.view_all')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'session_id' => ['nullable', 'uuid'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        [$rangeStart, $rangeEnd] = ReportDateRange::fromRequest($request);

        $visibleUserIds = $this->access->visibleUserIds($user);

        if (isset($validated['user_id'])) {
            if (! $this->access->canViewUser($user, (int) $validated['user_id'])) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        }

        $query = Screenshot::query()
            ->with(['user', 'project'])
            ->orderByDesc('captured_at');

        if ($visibleUserIds !== null) {
            $query->whereIn('user_id', $visibleUserIds);
        }

        if (isset($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (isset($validated['session_id'])) {
            $query->where('session_id', $validated['session_id']);
        }

        $query->whereBetween('captured_at', [$rangeStart, $rangeEnd]);

        $perPage = $validated['per_page'] ?? 24;

        return ScreenshotResource::collection(
            $query->paginate($perPage)
        );
    }
}
