<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class AuditLogger
{
    /**
     * @param  array<string, mixed>|null  $properties
     */
    public function log(
        string $event,
        ?Model $auditable = null,
        ?User $actor = null,
        ?array $properties = null
    ): AuditLog {
        $actor ??= auth()->user();

        return AuditLog::query()->create([
            'organization_id' => TenantContext::id(),
            'user_id' => $actor?->id,
            'auditable_type' => $auditable ? $auditable::class : 'system',
            'auditable_id' => $auditable?->getKey(),
            'event' => $event,
            'properties' => $properties,
            'created_at' => Carbon::now(),
        ]);
    }
}
