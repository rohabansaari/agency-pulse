<?php

namespace App\Http\Resources;

use App\Services\Screenshots\ScreenshotStorageService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Screenshot */
class ScreenshotResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var ScreenshotStorageService $storage */
        $storage = app(ScreenshotStorageService::class);

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'organization_id' => $this->organization_id,
            'project_id' => $this->project_id,
            'project_name' => $this->whenLoaded('project', fn () => $this->project?->name),
            'session_id' => $this->session_id,
            'image_url' => $storage->url($this->resource),
            'file_size_bytes' => $this->file_size_bytes,
            'captured_at' => $this->captured_at,
            'created_at' => $this->created_at,
        ];
    }
}
